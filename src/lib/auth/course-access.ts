import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/auth/rbac";
import type { Database } from "@/types/database.types";

const UNAUTHORIZED = "Недостаточно прав для изменения этого курса.";

export const COURSE_MUTATION_SELECT =
  "*, owner:profiles!courses_teacher_id_fkey(role)";

type CourseAccessInput = {
  userId: string;
  role: Role;
  courseId: string;
  teacherId: string;
  courseOwnerRole: Role | null;
};

export function getCourseOwnerRole(course: any): Role | null {
  const owner = course?.owner;
  const row = Array.isArray(owner) ? owner[0] : owner;
  return (row?.role as Role | undefined) ?? null;
}

/**
 * Кто может менять курс:
 * админ — всегда; владелец — всегда; завуч — только курсы teacher;
 * иначе — запись в course_curators.
 */
export async function assertCourseMutationAccess(
  supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  if (input.role === "head_teacher" && input.courseOwnerRole === "teacher") {
    return null;
  }

  // Таблица course_curators может ещё не быть в generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curator } = await (supabase as any)
    .from("course_curators")
    .select("user_id")
    .eq("course_id", input.courseId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (curator?.user_id) {
    return null;
  }

  return UNAUTHORIZED;
}

const DELETE_UNAUTHORIZED = "Недостаточно прав для удаления этого курса.";

/**
 * Кто может архивировать курс: админ, владелец или завуч (только курсы teacher).
 * Кураторы удалять не могут.
 */
export async function assertCourseDeleteAccess(
  _supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  if (input.role === "head_teacher" && input.courseOwnerRole === "teacher") {
    return null;
  }

  return DELETE_UNAUTHORIZED;
}

const CURATOR_MANAGE_UNAUTHORIZED =
  "Недостаточно прав для управления кураторами этого курса.";

/**
 * Кто может назначать и снимать кураторов:
 * админ, владелец или завуч (только курсы teacher).
 * Кураторы управлять другими кураторами не могут.
 */
export async function assertCuratorManagementAccess(
  _supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  if (input.role === "head_teacher" && input.courseOwnerRole === "teacher") {
    return null;
  }

  return CURATOR_MANAGE_UNAUTHORIZED;
}
