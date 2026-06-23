"use server";

import { revalidatePath } from "next/cache";

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

  if (role !== "student" && role !== "teacher" && role !== "admin") {
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
