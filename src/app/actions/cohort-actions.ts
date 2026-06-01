"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cid)
    .maybeSingle();

  if (courseError || !course) {
    return { success: false, error: "Курс не найден." };
  }

  if (course.teacher_id !== user.id) {
    return { success: false, error: "Нет прав на создание группы для этого курса." };
  }

  for (let attempt = 0; attempt < PIN_INSERT_MAX_ATTEMPTS; attempt += 1) {
    const pin_code = generatePinCode();
    const { data: inserted, error: insertError } = await supabase
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, course_id, is_active")
    .eq("id", cid)
    .maybeSingle();

  if (cohortError || !cohort) {
    return { success: false, error: "Группа не найдена." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cohort.course_id)
    .maybeSingle();

  if (courseError || !course) {
    return { success: false, error: "Курс группы не найден." };
  }

  if (course.teacher_id !== user.id) {
    return { success: false, error: "Нет прав на изменение статуса этой группы." };
  }

  const { error: updateError } = await supabase
    .from("cohorts")
    .update({ is_active: isActive })
    .eq("id", cohort.id);

  if (updateError) {
    console.error("[updateCohortStatus]", updateError.message);
    return {
      success: false,
      error: updateError.message || "Не удалось обновить статус группы.",
    };
  }

  revalidatePath("/dashboard/cohorts");
  revalidatePath(`/dashboard/cohorts/${cohort.id}`);
  return { success: true, isActive };
}

type AssignableContentInput = {
  cohortId: string;
  lessonId: string;
  isRequired?: boolean;
  dueDate?: string | null;
};

async function validateTeacherOwnsCohort(cohortId: string): Promise<
  | { ok: true; userId: string; courseId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Нужна авторизация." };
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError || !cohort) {
    return { ok: false, error: "Группа не найдена." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cohort.course_id)
    .maybeSingle();

  if (courseError || !course) {
    return { ok: false, error: "Курс группы не найден." };
  }

  if (course.teacher_id !== user.id) {
    return { ok: false, error: "Нет прав на изменение назначений этой группы." };
  }

  return { ok: true, userId: user.id, courseId: course.id };
}

export async function assignContentToCohort(
  input: AssignableContentInput,
): Promise<AssignContentToCohortResult> {
  const cohortId = input.cohortId.trim();
  if (!cohortId) {
    return { success: false, error: "Не выбрана группа." };
  }

  const ownership = await validateTeacherOwnsCohort(cohortId);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await createClient();
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

  const ownership = await validateTeacherOwnsCohort(cohortId);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await createClient();
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

  const normalized = itemIds
    .map((it) => ({ id: it.id.trim(), type: it.type }))
    .filter((it) => it.id.length > 0);

  if (normalized.length === 0) {
    return { success: true };
  }

  const ownership = await validateTeacherOwnsCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await createClient();
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

  const normalized = itemIds
    .map((it) => ({ id: it.id.trim(), type: it.type }))
    .filter((it) => it.id.length > 0);

  if (normalized.length === 0) {
    return { success: true };
  }

  const ownership = await validateTeacherOwnsCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await createClient();
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

export type CohortStudentRow = {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
};

/**
 * Ученики группы с корректными именами (profiles + email fallback).
 * Доступно владельцу курса группы.
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

  const ownership = await validateTeacherOwnsCohort(cid);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const supabase = await createClient();

  const [{ data: enrollmentsData, error: enrollmentsError }, { data: emailRowsRaw, error: emailsError }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, user_id, enrolled_at")
        .eq("cohort_id", cid)
        .order("enrolled_at", { ascending: false }),
      supabase.rpc("get_cohort_student_emails", { p_cohort_id: cid }),
    ]);

  if (enrollmentsError) {
    return { success: false, error: enrollmentsError.message };
  }
  if (emailsError) {
    console.error("[getCohortStudents] emails rpc", emailsError.message);
  }

  const enrollments = enrollmentsData ?? [];
  const userIds = enrollments.map((e) => e.user_id);

  const profileNameByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      console.error("[getCohortStudents] profiles", profilesError.message);
    } else {
      for (const p of profileRows ?? []) {
        profileNameByUserId.set(p.id, p.full_name);
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
    const fullName =
      profileNameByUserId.get(row.user_id) ?? emailRow?.full_name ?? null;
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
    };
  });

  return { success: true, students };
}
