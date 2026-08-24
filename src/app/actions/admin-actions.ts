"use server";

import { revalidatePath } from "next/cache";

import { verifyAccess } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireAdmin():
  Promise<
    | { userId: string }
    | { success: false; error: string }
  > {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return { success: false, error: "Профиль не найден." };
  }

  if (profile.role !== "admin") {
    return { success: false, error: "Доступ только для администратора." };
  }

  return { userId: user.id };
}

function requireServiceRoleClient():
  | NonNullable<ReturnType<typeof createAdminClient>>
  | { success: false; error: string } {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      success: false,
      error:
        "Сервер не настроен для админ-операций (отсутствует SUPABASE_SERVICE_ROLE_KEY).",
    };
  }
  return adminClient;
}

/** Меняет роль пользователя (только admin; через service role из-за protect_profile_role). */
export async function updateUserRole(
  userId: string,
  role: ProfileRole,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth;
  }

  const uid = userId.trim();
  if (!uid) {
    return { success: false, error: "Не указан пользователь." };
  }

  if (uid === auth.userId) {
    return { success: false, error: "Нельзя изменить свою роль." };
  }

  if (
    role !== "student" &&
    role !== "teacher" &&
    role !== "admin" &&
    role !== "head_teacher"
  ) {
    return { success: false, error: "Недопустимая роль." };
  }

  const adminClient = requireServiceRoleClient();
  if ("success" in adminClient) {
    return adminClient;
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role })
    .eq("id", uid);

  if (error) {
    console.error("[updateUserRole]", error.message);
    return { success: false, error: "Не удалось обновить роль." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/** Удаляет пользователя из auth (каскадно удаляет profile). Только admin. */
export async function deleteUser(userId: string): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth;
  }

  const uid = userId.trim();
  if (!uid) {
    return { success: false, error: "Не указан пользователь." };
  }

  if (uid === auth.userId) {
    return { success: false, error: "Нельзя удалить свой аккаунт." };
  }

  const adminClient = requireServiceRoleClient();
  if ("success" in adminClient) {
    return adminClient;
  }

  const { error } = await adminClient.auth.admin.deleteUser(uid);
  if (error) {
    console.error("[deleteUser]", error.message);
    return { success: false, error: "Не удалось удалить пользователя." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/** Soft-delete профиля. Курсы и тесты не архивируются автоматически. */
export async function deactivateUser(
  targetUserId: string,
): Promise<AdminActionResult> {
  const { user } = await verifyAccess(["admin"]);

  const uid = targetUserId.trim();
  if (!uid) {
    return { success: false, error: "Не указан пользователь." };
  }

  if (uid === user.id) {
    return { success: false, error: "Нельзя деактивировать свой аккаунт." };
  }

  const supabase = await createClient();

  // is_active ещё нет в generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ is_active: false })
    .eq("id", uid);

  if (error) {
    console.error("[deactivateUser]", error.message);
    return {
      success: false,
      error: error.message || "Не удалось уволить сотрудника.",
    };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export type ResetUserPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

/** Задаёт новый пароль пользователю (только admin, через service role). */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ResetUserPasswordResult> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const uid = userId.trim();
  if (!uid) {
    return { ok: false, error: "Не указан пользователь." };
  }

  if (uid === auth.userId) {
    return { ok: false, error: "Нельзя сбросить свой пароль через эту форму." };
  }

  const password = newPassword.trim();
  if (password.length < 6) {
    return { ok: false, error: "Пароль должен содержать минимум 6 символов." };
  }

  const adminClient = requireServiceRoleClient();
  if ("success" in adminClient) {
    return { ok: false, error: adminClient.error };
  }

  const { error } = await adminClient.auth.admin.updateUserById(uid, {
    password,
  });

  if (error) {
    console.error("[resetUserPassword]", error.message);
    return { ok: false, error: "Не удалось обновить пароль." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
