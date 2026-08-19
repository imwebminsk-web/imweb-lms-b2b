"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export type SetupRootOrganizationResult =
  | { data: OrganizationRow; error: null }
  | { data: null; error: string };

const setupSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  companyName: z.string().min(1, "Название компании обязательно"),
});

export type SetupInput = z.infer<typeof setupSchema>;

function slugifyOrganizationName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return base.length > 0 ? base : "root-organization";
}

export async function checkIsInitialized(): Promise<boolean> {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return false;
  }

  const { data, error } = await adminClient
    .from("organizations")
    .select("id")
    .limit(1);

  if (error) {
    console.error("checkIsInitialized: select orgs failed", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function setupRootOrganization(
  input: SetupInput,
): Promise<SetupRootOrganizationResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0]?.message ?? "Ошибка валидации" };
  }

  const { email, password, companyName } = parsed.data;

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      data: null,
      error: "Сервер не настроен (отсутствует SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  // 1. Check if ANY organization exists
  const { data: existingOrgs, error: existingOrgError } = await adminClient
    .from("organizations")
    .select("id")
    .limit(1);

  if (existingOrgError) {
    console.error("setupRootOrganization: select orgs failed", existingOrgError);
    return { data: null, error: "Ошибка при проверке существующих организаций." };
  }

  if (existingOrgs && existingOrgs.length > 0) {
    return { data: null, error: "Платформа уже инициализирована." };
  }

  // 2. Create admin user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error("setupRootOrganization: create user failed", authError);
    return { data: null, error: `Ошибка создания пользователя: ${authError.message}` };
  }

  const userId = authData.user.id;

  // 3. Set role = 'admin' in profiles
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userId);

  if (profileError) {
    console.error("setupRootOrganization: update profile failed", profileError);
    // Continue anyway, but this is a critical issue
  }

  // 4. Update platform_settings
  const { error: settingsError } = await adminClient
    .from("platform_settings")
    .update({ organization_name: companyName.trim() })
    .eq("is_singleton", true);

  if (settingsError) {
    console.error("setupRootOrganization: update settings failed", settingsError);
  }

  // 5. Insert root organization
  const slug = slugifyOrganizationName(companyName);

  const { data: created, error: insertError } = await adminClient
    .from("organizations")
    .insert({
      name: companyName.trim(),
      slug,
    })
    .select("id, name, slug, created_at")
    .single();

  if (insertError) {
    console.error("setupRootOrganization: insert org failed", insertError);
    return { data: null, error: `Ошибка создания организации: ${insertError.message}` };
  }

  return { data: created, error: null };
}
