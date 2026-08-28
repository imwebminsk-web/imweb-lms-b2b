"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifyAccess, type Role } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";

const PIN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PIN_LENGTH = 6;
const PIN_INSERT_MAX_ATTEMPTS = 10;

export type CreateCohortResult =
  | { success: true; pinCode: string; cohortId: string }
  | { success: false; error: string };

export type UpdateCohortStatusResult =
  | { success: true; isActive: boolean }
  | { success: false; error: string };

export type UpdateCohortSettingsResult =
  | { success: true }
  | { success: false; error: string };

export type DeleteCohortResult = { success: false; error: string };

export type AssignContentToCohortResult =
  | { success: true }
  | { success: false; error: string };

export type BulkAssignableItem = {
  id: string;
  type: "lesson";
};

function generatePinCode(): string {
  let pin = "";
  for (let i = 0; i < PIN_LENGTH; i += 1) {
    pin += PIN_ALPHABET[randomInt(PIN_ALPHABET.length)]!;
  }
  return pin;
}

const STAFF_ROLES: Role[] = ["admin", "head_teacher", "teacher"];
const COHORT_FORBIDDEN = "Недостаточно прав для управления этой группой.";

type CohortManageAccess =
  | { ok: true; userId: string; courseId: string }
  | { ok: false; error: string };

/** User-клиент не проходит RLS для admin/куратора на чужих cohorts. */
async function getActionDb() {
  return createAdminClient() ?? (await createClient());
}

export async function getStaffDb() {
  return getActionDb();
}

async function isCourseCurator(
  courseId: string,
  userId: string,
): Promise<boolean> {
  const db = await getActionDb();
  // course_curators ещё нет в generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("course_curators")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.user_id);
}

function canManageCourse(
  role: Role,
  userId: string,
  teacherId: string,
): boolean {
  return role === "admin" || role === "head_teacher" || teacherId === userId;
}

async function assertCanManageCourse(
  courseId: string,
): Promise<CohortManageAccess> {
  const { user, profile } = await verifyAccess(STAFF_ROLES);
  const db = await getActionDb();

  const { data: course, error } = await db
    .from("courses")
    .select("id, teacher_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error || !course) {
    return { ok: false, error: "Курс не найден." };
  }

  if (canManageCourse(profile.role, user.id, course.teacher_id)) {
    return { ok: true, userId: user.id, courseId: course.id };
  }

  if (await isCourseCurator(course.id, user.id)) {
    return { ok: true, userId: user.id, courseId: course.id };
  }

  return { ok: false, error: COHORT_FORBIDDEN };
}

export async function assertCanManageCohort(
  cohortId: string,
): Promise<CohortManageAccess> {
  const { user, profile } = await verifyAccess(STAFF_ROLES);
  const db = await getActionDb();

  const { data: cohort, error: cohortError } = await db
    .from("cohorts")
    .select("id, course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError || !cohort) {
    return { ok: false, error: "Группа не найдена." };
  }

  const { data: course, error: courseError } = await db
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cohort.course_id)
    .maybeSingle();

  if (courseError || !course) {
    return { ok: false, error: "Курс группы не найден." };
  }

  if (canManageCourse(profile.role, user.id, course.teacher_id)) {
    return { ok: true, userId: user.id, courseId: course.id };
  }

  if (await isCourseCurator(course.id, user.id)) {
    return { ok: true, userId: user.id, courseId: course.id };
  }

  return { ok: false, error: COHORT_FORBIDDEN };
}

export type StaffCourseOption = {
  id: string;
  title: string;
};

export type StaffCohortListItem = {
  id: string;
  name: string;
  pin_code: string;
  is_active: boolean;
  created_at: string;
  courses: { title: string } | { title: string }[] | null;
};

async function getCuratedCourseIdsForUser(userId: string): Promise<string[]> {
  const db = await getActionDb();
  // course_curators ещё нет в generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("course_curators")
    .select("course_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getCuratedCourseIdsForUser]", error.message);
    return [];
  }

  return ((data as Array<{ course_id: string }> | null) ?? [])
    .map((row) => row.course_id)
    .filter(Boolean);
}

/**
 * Курсы и группы, которыми сотрудник может управлять:
 * admin/завуч — все; teacher — свои курсы + курсы, где он куратор.
 */
export async function getStaffCohortsDashboard(): Promise<{
  courses: StaffCourseOption[];
  cohorts: StaffCohortListItem[];
}> {
  const { user, profile } = await verifyAccess(STAFF_ROLES);
  const db = await getActionDb();
  const privileged = profile.role === "admin" || profile.role === "head_teacher";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coursesQuery: any = db.from("courses").select("id, title").order("title");

  if (!privileged) {
    const curatedIds = await getCuratedCourseIdsForUser(user.id);
    if (curatedIds.length > 0) {
      coursesQuery = coursesQuery.or(
        `teacher_id.eq.${user.id},id.in.(${curatedIds.join(",")})`,
      );
    } else {
      coursesQuery = coursesQuery.eq("teacher_id", user.id);
    }
  }

  const { data: myCourses, error: coursesError } = await coursesQuery;
  if (coursesError) {
    console.error("[getStaffCohortsDashboard] courses", coursesError.message);
  }

  const courses: StaffCourseOption[] = (myCourses ?? []).map(
    (c: { id: string; title: string }) => ({
      id: c.id,
      title: c.title,
    }),
  );
  const courseIds = courses.map((c) => c.id);

  if (!privileged && courseIds.length === 0) {
    return { courses, cohorts: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cohortsQuery: any = db
    .from("cohorts")
    .select("id, name, pin_code, is_active, created_at, courses(title)")
    .order("created_at", { ascending: false });

  if (!privileged) {
    cohortsQuery = cohortsQuery.in("course_id", courseIds);
  }

  const { data: cohortsData, error: cohortsError } = await cohortsQuery;
  if (cohortsError) {
    console.error("[getStaffCohortsDashboard] cohorts", cohortsError.message);
  }

  return {
    courses,
    cohorts: (cohortsData ?? []) as StaffCohortListItem[],
  };
}

/**
 * Создаёт группу по курсу с уникальным PIN (6 символов A–Z и цифры).
 * Повторяет вставку при коллизии UNIQUE(pin_code).
 */
export async function createCohort(
  courseId: string,
  name: string,
): Promise<CreateCohortResult> {
  const cid = courseId.trim();
  const groupName = name.trim();

  if (!cid) {
    return { success: false, error: "Не выбран курс." };
  }
  if (!groupName) {
    return { success: false, error: "Введите название группы." };
  }
  if (groupName.length > 200) {
    return { success: false, error: "Название не длиннее 200 символов." };
  }

  const access = await assertCanManageCourse(cid);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const db = await getActionDb();

  for (let attempt = 0; attempt < PIN_INSERT_MAX_ATTEMPTS; attempt += 1) {
    const pin_code = generatePinCode();
    const { data: inserted, error: insertError } = await db
      .from("cohorts")
      .insert({
        course_id: cid,
        name: groupName,
        pin_code,
        is_active: true,
      })
      .select("id")
      .single();

    if (!insertError && inserted) {
      revalidatePath("/dashboard/cohorts");
      return { success: true, pinCode: pin_code, cohortId: inserted.id };
    }

    const msg = insertError?.message ?? "";
    if (
      msg.includes("cohorts_pin_code_key") ||
      msg.includes("duplicate key") ||
      msg.includes("unique constraint")
    ) {
      continue;
    }

    console.error("[createCohort]", msg);
    return {
      success: false,
      error: insertError?.message || "Не удалось создать группу.",
    };
  }

  return {
    success: false,
    error: "Не удалось сгенерировать уникальный PIN. Попробуйте ещё раз.",
  };
}

export async function updateCohortStatus(
  cohortId: string,
  isActive: boolean,
): Promise<UpdateCohortStatusResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не выбрана группа." };
  }

  const access = await assertCanManageCohort(cid);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const db = await getActionDb();
  const { error: updateError } = await db
    .from("cohorts")
    .update({ is_active: isActive })
    .eq("id", cid);

  if (updateError) {
    console.error("[updateCohortStatus]", updateError.message);
    return {
      success: false,
      error: updateError.message || "Не удалось обновить статус группы.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cid}`);
  return { success: true, isActive };
}

export async function updateCohortSettings(
  cohortId: string,
  data: {
    name?: string;
    is_chat_enabled?: boolean;
    requires_approval?: boolean;
  },
): Promise<UpdateCohortSettingsResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const payload: {
    name?: string;
    is_chat_enabled?: boolean;
    requires_approval?: boolean;
  } = {};

  if (data.name !== undefined) {
    const groupName = data.name.trim();
    if (!groupName) {
      return { success: false, error: "Введите название группы." };
    }
    if (groupName.length > 200) {
      return { success: false, error: "Название не длиннее 200 символов." };
    }
    payload.name = groupName;
  }

  if (data.is_chat_enabled !== undefined) {
    payload.is_chat_enabled = data.is_chat_enabled;
  }

  if (data.requires_approval !== undefined) {
    payload.requires_approval = data.requires_approval;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: "Нет данных для обновления." };
  }

  const supabase = await getActionDb();
  const { error: updateError } = await supabase
    .from("cohorts")
    .update(payload)
    .eq("id", cid);

  if (updateError) {
    console.error("[updateCohortSettings]", updateError.message);
    return {
      success: false,
      error: updateError.message || "Не удалось обновить настройки группы.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cid}`);
  return { success: true };
}

export async function deleteCohort(
  cohortId: string,
): Promise<DeleteCohortResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await getActionDb();
  const { error: deleteError } = await supabase
    .from("cohorts")
    .delete()
    .eq("id", cid);

  if (deleteError) {
    console.error("[deleteCohort]", deleteError.message);
    return {
      success: false,
      error: deleteError.message || "Не удалось удалить группу.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  redirect("/dashboard/cohorts");
}

type AssignableContentInput = {
  cohortId: string;
  lessonId: string;
  isRequired?: boolean;
  dueDate?: string | null;
};

export async function assignContentToCohort(
  input: AssignableContentInput,
): Promise<AssignContentToCohortResult> {
  const cohortId = input.cohortId.trim();
  if (!cohortId) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await assertCanManageCohort(cohortId);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await getActionDb();
  const basePayload = {
    cohort_id: cohortId,
    is_required: input.isRequired ?? true,
    due_date: input.dueDate ?? null,
  };
  const lessonId = input.lessonId.trim();
  if (!lessonId) {
    return { success: false, error: "Не указан урок." };
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, modules!inner(course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError || !lesson) {
    return { success: false, error: "Урок не найден." };
  }

  const lessonCourseId = Array.isArray(lesson.modules)
    ? lesson.modules[0]?.course_id
    : lesson.modules?.course_id;

  if (!lessonCourseId || lessonCourseId !== ownership.courseId) {
    return { success: false, error: "Урок не принадлежит курсу этой группы." };
  }

  const { error: insertError } = await supabase.from("cohort_assignments").upsert(
    {
      ...basePayload,
      lesson_id: lessonId,
      test_id: null,
    },
    {
      onConflict: "cohort_id,lesson_id",
      ignoreDuplicates: false,
    },
  );

  if (insertError) {
    return {
      success: false,
      error: insertError.message || "Не удалось назначить урок группе.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cohortId}`);
  return { success: true };
}

export async function unassignContentFromCohort(
  input: { cohortId: string; lessonId?: string },
): Promise<AssignContentToCohortResult> {
  const cohortId = input.cohortId.trim();
  if (!cohortId) {
    return { success: false, error: "Не выбрана группа." };
  }

  const lessonId = input.lessonId?.trim() ?? "";
  if (!lessonId) {
    return { success: false, error: "Не указан контент для снятия назначения." };
  }

  const ownership = await assertCanManageCohort(cohortId);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await getActionDb();
  const { error } = await supabase
    .from("cohort_assignments")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("lesson_id", lessonId);
  if (error) {
    return {
      success: false,
      error: error.message || "Не удалось снять назначение контента.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cohortId}`);
  return { success: true };
}

export async function bulkAssignContentToCohort(
  cohortId: string,
  itemIds: BulkAssignableItem[],
): Promise<AssignContentToCohortResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const normalized = itemIds
    .map((it) => ({ id: it.id.trim(), type: it.type }))
    .filter((it) => it.id.length > 0);

  if (normalized.length === 0) {
    return { success: true };
  }

  const supabase = await getActionDb();
  const lessonIds = normalized.map((x) => x.id);

  const { data: lessonRows, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, modules!inner(course_id)")
    .in("id", lessonIds);

  if (lessonsError) {
    return { success: false, error: lessonsError.message || "Не удалось проверить уроки." };
  }

  const validLessonIds = (lessonRows ?? [])
    .filter((row) => {
      const courseId = Array.isArray(row.modules)
        ? row.modules[0]?.course_id
        : row.modules?.course_id;
      return courseId === ownership.courseId;
    })
    .map((row) => row.id);

  if (validLessonIds.length > 0) {
    const { error: insertLessonsError } = await supabase
      .from("cohort_assignments")
      .upsert(
        validLessonIds.map((id) => ({
          cohort_id: cid,
          lesson_id: id,
          test_id: null,
          is_required: true,
        })),
        { onConflict: "cohort_id,lesson_id", ignoreDuplicates: false },
      );

    if (insertLessonsError) {
      return {
        success: false,
        error: insertLessonsError.message || "Не удалось назначить уроки группе.",
      };
    }
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cid}`);
  return { success: true };
}

export async function bulkUnassignContentFromCohort(
  cohortId: string,
  itemIds: BulkAssignableItem[],
): Promise<AssignContentToCohortResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const normalized = itemIds
    .map((it) => ({ id: it.id.trim(), type: it.type }))
    .filter((it) => it.id.length > 0);

  if (normalized.length === 0) {
    return { success: true };
  }

  const supabase = await getActionDb();
  const lessonIds = normalized.map((x) => x.id);
  const { error: deleteLessonsError } = await supabase
    .from("cohort_assignments")
    .delete()
    .eq("cohort_id", cid)
    .in("lesson_id", lessonIds);

  if (deleteLessonsError) {
    return {
      success: false,
      error: deleteLessonsError.message || "Не удалось снять назначения уроков.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cid}`);
  return { success: true };
}

export type EnrollmentStatus = "active" | "pending" | "suspended";

export type CohortStudentRow = {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
  avatarUrl: string | null;
  status: EnrollmentStatus;
};

function normalizeEnrollmentStatus(value: string | null | undefined): EnrollmentStatus {
  if (value === "pending" || value === "suspended") {
    return value;
  }
  return "active";
}

/**
 * Ученики группы с корректными именами (profiles + email fallback).
 * Доступно админу, завучу, владельцу курса и куратору курса.
 */
export async function getCohortStudents(
  cohortId: string,
): Promise<
  | { success: true; students: CohortStudentRow[] }
  | { success: false; error: string }
> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не указана группа." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const db = await getActionDb();
  const userClient = await createClient();

  const [{ data: enrollmentsData, error: enrollmentsError }, { data: emailRowsRaw, error: emailsError }] =
    await Promise.all([
      db
        .from("enrollments")
        .select("id, user_id, enrolled_at, status")
        .eq("cohort_id", cid)
        .order("enrolled_at", { ascending: false }),
      // RPC проверяет auth.uid() = владелец курса — нужен user-клиент, не service role.
      userClient.rpc("get_cohort_student_emails", { p_cohort_id: cid }),
    ]);

  if (enrollmentsError) {
    return { success: false, error: enrollmentsError.message };
  }
  if (emailsError) {
    console.error("[getCohortStudents] emails rpc", emailsError.message);
  }

  const enrollments = enrollmentsData ?? [];
  const userIds = enrollments.map((e) => e.user_id);

  const profileByUserId = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await db
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error("[getCohortStudents] profiles", profilesError.message);
    } else {
      for (const p of profileRows ?? []) {
        profileByUserId.set(p.id, {
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        });
      }
    }
  }

  type EmailRow = { user_id: string; email: string | null; full_name: string | null };
  const emailByUserId = new Map<string, EmailRow>();
  for (const row of (emailRowsRaw ?? []) as EmailRow[]) {
    emailByUserId.set(row.user_id, row);
  }

  const students: CohortStudentRow[] = enrollments.map((row) => {
    const emailRow = emailByUserId.get(row.user_id);
    const email = emailRow?.email?.trim() || "—";
    const profileRow = profileByUserId.get(row.user_id);
    const fullName =
      profileRow?.full_name ?? emailRow?.full_name ?? null;
    return {
      enrollmentId: row.id,
      userId: row.user_id,
      name: resolveStudentDisplayName(
        fullName,
        email === "—" ? null : email,
        row.user_id,
      ),
      email,
      enrolledAt: row.enrolled_at,
      avatarUrl: profileRow?.avatar_url ?? null,
      status: normalizeEnrollmentStatus(row.status),
    };
  });

  return { success: true, students };
}

export type UpdateEnrollmentStatusResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Меняет статус записи ученика в группе (одобрение, приостановка, возврат доступа).
 */
export async function updateEnrollmentStatus(
  userId: string,
  cohortId: string,
  status: EnrollmentStatus,
): Promise<UpdateEnrollmentStatusResult> {
  const uid = userId.trim();
  const cid = cohortId.trim();

  if (!uid || !cid) {
    return { success: false, error: "Не указаны ученик или группа." };
  }

  if (status !== "active" && status !== "pending" && status !== "suspended") {
    return { success: false, error: "Некорректный статус записи." };
  }

  const ownership = await assertCanManageCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const db = await getActionDb();
  const { data: updated, error: updateError } = await db
    .from("enrollments")
    .update({ status })
    .eq("user_id", uid)
    .eq("cohort_id", cid)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("[updateEnrollmentStatus]", updateError.message);
    return {
      success: false,
      error: updateError.message || "Не удалось обновить статус ученика.",
    };
  }

  if (!updated) {
    return { success: false, error: "Запись ученика в этой группе не найдена." };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cid}`);
  revalidatePath("/dashboard");
  return { success: true };
}
