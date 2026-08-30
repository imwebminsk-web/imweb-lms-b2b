"use server";

import { revalidatePath } from "next/cache";

import {
  assertCuratorManagementAccess,
  COURSE_MUTATION_SELECT,
  getCourseOwnerRole,
} from "@/lib/auth/course-access";
import { verifyAccess, type Role } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  manageCuratorSchema,
  type ManageCuratorPayload,
} from "@/lib/validations/course-schemas";

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

export type CuratorMutationResult =
  | { ok: true }
  | { ok: false; error: string };

const ASSIGNABLE_ROLES: Role[] = ["teacher", "head_teacher"];
const RESTORE_OWNER_ROLES: Role[] = ["teacher", "head_teacher", "admin"];

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

export async function getRestoreOwnerCandidates(): Promise<{
  data: CuratorCandidate[] | null;
  error: string | null;
}> {
  await verifyAccess(["admin"]);

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.error("[getRestoreOwnerCandidates] admin client is not configured");
      return { data: null, error: "Не удалось загрузить список владельцев." };
    }

    // is_active ещё может отсутствовать в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("profiles")
      .select("id, full_name, role")
      .in("role", RESTORE_OWNER_ROLES)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[getRestoreOwnerCandidates]", error.message);
      return { data: null, error: "Не удалось загрузить список владельцев." };
    }

    const mapped: CuratorCandidate[] = (data ?? []).map((row: {
      id: string;
      full_name: string | null;
      role: Role;
    }) => ({
      id: row.id,
      fullName: row.full_name,
      role: row.role,
    }));

    return { data: mapped, error: null };
  } catch (err) {
    console.error("[getRestoreOwnerCandidates] Unexpected error:", err);
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
  data: ManageCuratorPayload,
): Promise<CuratorMutationResult> {
  return {
    ok: false,
    error: "Функция кураторства временно отключена",
  };

  const parsed = manageCuratorSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const { courseId, userId: uid } = parsed.data;

  const access = await requireCuratorManagementAccess(courseId);
  if ("error" in access && access.error) {
    return { ok: false, error: access.error };
  }

  try {
    if (uid === access.course.teacher_id) {
      return { ok: false, error: "Владелец курса уже имеет полный доступ." };
    }

    const { data: target, error: targetErr } = await access.supabase
      .from("profiles")
      .select("id, role")
      .eq("id", uid)
      .maybeSingle();

    if (targetErr || !target) {
      return { ok: false, error: "Пользователь не найден." };
    }

    if (!ASSIGNABLE_ROLES.includes(target.role)) {
      return { ok: false, error: "Куратором может быть только преподаватель или завуч." };
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
        return { ok: false, error: "Этот пользователь уже назначен куратором." };
      }
      console.error("[addCourseCurator]", insertErr.message);
      return { ok: false, error: "Не удалось добавить куратора" };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${access.course.slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[addCourseCurator] Unexpected error:", err);
    return { ok: false, error: "Не удалось добавить куратора" };
  }
}

export async function removeCourseCurator(
  data: ManageCuratorPayload,
): Promise<CuratorMutationResult> {
  return {
    ok: false,
    error: "Функция кураторства временно отключена",
  };

  const parsed = manageCuratorSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const { courseId, userId: uid } = parsed.data;

  const access = await requireCuratorManagementAccess(courseId);
  if ("error" in access && access.error) {
    return { ok: false, error: access.error };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteErr } = await (access.supabase as any)
      .from("course_curators")
      .delete()
      .eq("course_id", access.course.id)
      .eq("user_id", uid);

    if (deleteErr) {
      console.error("[removeCourseCurator]", deleteErr.message);
      return { ok: false, error: "Не удалось удалить куратора" };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${access.course.slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[removeCourseCurator] Unexpected error:", err);
    return { ok: false, error: "Не удалось удалить куратора" };
  }
}
