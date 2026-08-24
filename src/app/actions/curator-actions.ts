"use server";

import { revalidatePath } from "next/cache";

import {
  assertCuratorManagementAccess,
  COURSE_MUTATION_SELECT,
  getCourseOwnerRole,
} from "@/lib/auth/course-access";
import { verifyAccess, type Role } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export type CuratorCandidate = {
  id: string;
  fullName: string | null;
  role: Role;
};

export type CourseCurator = {
  userId: string;
  fullName: string | null;
  role: Role | null;
};

export type CuratorActionState = {
  success?: boolean;
  error?: string;
};

const ASSIGNABLE_ROLES: Role[] = ["teacher", "head_teacher"];

function unwrapRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

async function requireCuratorManagementAccess(courseId: string) {
  const { user, profile } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
  ]);

  const cid = courseId.trim();
  if (!cid) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    // @ts-expect-error owner alias is not in generated Database types yet
    .select(COURSE_MUTATION_SELECT)
    .eq("id", cid)
    .maybeSingle();

  if (courseErr || !course) {
    return { error: "Курс не найден." };
  }

  const accessError = await assertCuratorManagementAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: course.id,
    teacherId: course.teacher_id,
    courseOwnerRole: getCourseOwnerRole(course),
  });

  if (accessError) {
    return { error: accessError };
  }

  return { user, profile, supabase, course };
}

export async function getAvailableCurators(): Promise<{
  data: CuratorCandidate[] | null;
  error: string | null;
}> {
  await verifyAccess(["admin", "head_teacher", "teacher"]);

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ASSIGNABLE_ROLES)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[getAvailableCurators]", error.message);
      return { data: null, error: "Не удалось загрузить список кураторов." };
    }

    const mapped: CuratorCandidate[] = (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      role: row.role,
    }));

    return { data: mapped, error: null };
  } catch (err) {
    console.error("[getAvailableCurators] Unexpected error:", err);
    return { data: null, error: "Внутренняя ошибка сервера" };
  }
}

export async function getCourseCurators(courseId: string): Promise<{
  data: CourseCurator[] | null;
  error: string | null;
}> {
  const access = await requireCuratorManagementAccess(courseId);
  if ("error" in access && access.error) {
    return { data: null, error: access.error };
  }

  try {
    // Таблица course_curators ещё нет в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (access.supabase as any)
      .from("course_curators")
      .select(
        `
        user_id,
        profile:profiles!course_curators_user_id_fkey (
          id,
          full_name,
          role
        )
      `,
      )
      .eq("course_id", access.course.id);

    if (error) {
      console.error("[getCourseCurators]", error.message);
      return { data: null, error: "Не удалось загрузить кураторов курса." };
    }

    const mapped: CourseCurator[] = (
      (data as Array<{
        user_id: string;
        profile:
          | { id: string; full_name: string | null; role: Role | null }
          | { id: string; full_name: string | null; role: Role | null }[]
          | null;
      }> | null) ?? []
    ).map((row) => {
      const profile = unwrapRel(row.profile);
      return {
        userId: row.user_id,
        fullName: profile?.full_name ?? null,
        role: profile?.role ?? null,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("[getCourseCurators] Unexpected error:", err);
    return { data: null, error: "Внутренняя ошибка сервера" };
  }
}

export async function addCourseCurator(
  courseId: string,
  targetUserId: string,
): Promise<CuratorActionState> {
  const access = await requireCuratorManagementAccess(courseId);
  if ("error" in access && access.error) {
    return { error: access.error };
  }

  const uid = targetUserId.trim();
  if (!uid) {
    return { error: "Не указан пользователь." };
  }

  if (uid === access.course.teacher_id) {
    return { error: "Владелец курса уже имеет полный доступ." };
  }

  const { data: target, error: targetErr } = await access.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", uid)
    .maybeSingle();

  if (targetErr || !target) {
    return { error: "Пользователь не найден." };
  }

  if (!ASSIGNABLE_ROLES.includes(target.role)) {
    return { error: "Куратором может быть только преподаватель или завуч." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (access.supabase as any)
    .from("course_curators")
    .insert({
      course_id: access.course.id,
      user_id: uid,
      assigned_by: access.user.id,
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { error: "Этот пользователь уже назначен куратором." };
    }
    console.error("[addCourseCurator]", insertErr.message);
    return { error: insertErr.message || "Не удалось назначить куратора." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${access.course.slug}`);
  return { success: true };
}

export async function removeCourseCurator(
  courseId: string,
  targetUserId: string,
): Promise<CuratorActionState> {
  const access = await requireCuratorManagementAccess(courseId);
  if ("error" in access && access.error) {
    return { error: access.error };
  }

  const uid = targetUserId.trim();
  if (!uid) {
    return { error: "Не указан пользователь." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteErr } = await (access.supabase as any)
    .from("course_curators")
    .delete()
    .eq("course_id", access.course.id)
    .eq("user_id", uid);

  if (deleteErr) {
    console.error("[removeCourseCurator]", deleteErr.message);
    return { error: deleteErr.message || "Не удалось снять куратора." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${access.course.slug}`);
  return { success: true };
}
