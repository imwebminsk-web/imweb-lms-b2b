"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserSchema } from "@/lib/validations/admin-user-schema";

export type CreateUserByAdminResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin(): Promise<CreateUserByAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Требуется вход в систему." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, error: "Профиль не найден." };
  }

  if (profile.role !== "admin") {
    return { ok: false, error: "Доступ только для администратора." };
  }

  return { ok: true };
}

function mapCreateUserError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already") ||
    lower.includes("registered") ||
    lower.includes("exists") ||
    lower.includes("duplicate")
  ) {
    return "Пользователь с таким email уже существует.";
  }
  return "Не удалось создать пользователя.";
}

export async function createUserByAdmin(
  data: z.infer<typeof createUserSchema>,
): Promise<CreateUserByAdminResult> {
  const access = await requireAdmin();
  if (!access.ok) {
    return access;
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      ok: false,
      error:
        "Сервер не настроен для админ-операций (отсутствует SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const { fullName, email, role, password } = parsed.data;

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (authError || !authData.user) {
    if (authError) {
      console.error("[createUserByAdmin]", authError.message);
    }
    return {
      ok: false,
      error: authError
        ? mapCreateUserError(authError.message)
        : "Не удалось создать пользователя.",
    };
  }

  const userId = authData.user.id;

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role, full_name: fullName })
    .eq("id", userId);

  if (profileError) {
    console.error("[createUserByAdmin] profile", profileError.message);
    const { error: rollbackError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (rollbackError) {
      console.error("[createUserByAdmin] rollback", rollbackError.message);
    }
    return {
      ok: false,
      error: "Не удалось сохранить профиль пользователя.",
    };
  }

  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard");
  return { ok: true };
}
