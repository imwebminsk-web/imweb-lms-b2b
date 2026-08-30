import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
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

export type CourseMutationContext = {
  id: string;
  teacher_id: string;
  slug: string;
  courseOwnerRole: Role | null;
};

/**
 * Читает курс через user-клиент. RLS сам решает, видит ли текущий пользователь строку.
 */
export async function loadCourseForMutation(
  courseId: string,
): Promise<{ ok: true; course: CourseMutationContext } | { ok: false; error: string }> {
  const id = courseId.trim();
  if (!id) {
    return { ok: false, error: "Курс не найден." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_MUTATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[loadCourseForMutation]", error.message);
    return { ok: false, error: "Курс не найден." };
  }

  if (!data) {
    return { ok: false, error: "Курс не найден." };
  }

  const row = data as { id: string; teacher_id: string; slug: string };
  return {
    ok: true,
    course: {
      id: row.id,
      teacher_id: row.teacher_id,
      slug: row.slug,
      courseOwnerRole: getCourseOwnerRole(data),
    },
  };
}

export type LessonMutationContext = {
  lessonId: string;
  moduleId: string;
  course: CourseMutationContext;
};

/**
 * Читает урок → модуль → курс через user-клиент (RLS).
 */
export async function loadLessonForMutation(
  lessonId: string,
): Promise<
  | ({ ok: true } & LessonMutationContext)
  | { ok: false; error: string }
> {
  const id = lessonId.trim();
  if (!id) {
    return { ok: false, error: "Урок не найден." };
  }

  const supabase = await createClient();

  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, module_id")
    .eq("id", id)
    .maybeSingle();

  if (lessonErr) {
    console.error("[loadLessonForMutation]", lessonErr.message);
    return { ok: false, error: "Урок не найден." };
  }

  if (!lesson) {
    return { ok: false, error: "Урок не найден." };
  }

  const { data: moduleRow, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", lesson.module_id)
    .maybeSingle();

  if (moduleErr) {
    console.error("[loadLessonForMutation]", moduleErr.message);
    return { ok: false, error: "Урок не найден." };
  }

  if (!moduleRow) {
    return { ok: false, error: "Урок не найден." };
  }

  const loaded = await loadCourseForMutation(moduleRow.course_id);
  if (!loaded.ok) {
    return loaded;
  }

  return {
    ok: true,
    lessonId: lesson.id,
    moduleId: moduleRow.id,
    course: loaded.course,
  };
}

function isHeadTeacherOnAdminOwnedCourse(input: CourseAccessInput): boolean {
  return input.role === "head_teacher" && input.courseOwnerRole === "admin";
}

/**
 * Кто может менять курс:
 * админ — любой курс; завуч — любой, кроме курсов админа; владелец — свой.
 */
export async function assertCourseMutationAccess(
  _supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  if (input.role === "head_teacher" && !isHeadTeacherOnAdminOwnedCourse(input)) {
    return null;
  }

  return UNAUTHORIZED;
}

const DELETE_UNAUTHORIZED = "Недостаточно прав для удаления этого курса.";

/**
 * Кто может архивировать курс: админ — любой; завуч — любой, кроме курсов админа;
 * владелец — свой. Кураторы архивировать не могут.
 */
export async function assertCourseDeleteAccess(
  _supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (isHeadTeacherOnAdminOwnedCourse(input)) {
    return DELETE_UNAUTHORIZED;
  }

  if (input.role === "head_teacher") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  return DELETE_UNAUTHORIZED;
}

const CURATOR_MANAGE_UNAUTHORIZED =
  "Недостаточно прав для управления кураторами этого курса.";

/**
 * Кто может назначать и снимать кураторов:
 * админ — любой курс; завуч — любой, кроме курсов админа; владелец — свой.
 * Кураторы управлять другими кураторами не могут.
 */
export async function assertCuratorManagementAccess(
  _supabase: SupabaseClient<Database>,
  input: CourseAccessInput,
): Promise<string | null> {
  if (input.role === "admin") {
    return null;
  }

  if (isHeadTeacherOnAdminOwnedCourse(input)) {
    return CURATOR_MANAGE_UNAUTHORIZED;
  }

  if (input.role === "head_teacher") {
    return null;
  }

  if (input.teacherId === input.userId) {
    return null;
  }

  return CURATOR_MANAGE_UNAUTHORIZED;
}
