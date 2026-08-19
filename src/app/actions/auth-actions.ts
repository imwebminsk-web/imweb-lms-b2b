"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SignUpState = {
  error?: string;
};

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return "http://127.0.0.1:3000";
  }

  return `${protocol}://${host}`;
}

const initial: SignUpState = {};

/**
 * Регистрация через Supabase Auth.
 * При отключённом «Confirm email» сразу выдаётся сессия — редирект на /dashboard.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ...initial, error: "Укажите почту и пароль." };
  }

  if (password.length < 6) {
    return { ...initial, error: "Пароль не короче 6 символов." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { ...initial, error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    ...initial,
    error:
      "Аккаунт создан, но вход не выполнен. Попробуйте войти на странице входа.",
  };
}

/** Завершает сессию Supabase и перенаправляет на главную. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Совместимость со старыми импортами в проекте. */
export async function signOut() {
  await signOutAction();
}

/** Отправляет письмо со ссылкой для сброса пароля. */
export async function requestPasswordReset(
  email: string,
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return { ok: false, error: "Укажите email." };
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Устанавливает новый пароль для текущей recovery-сессии. */
export async function updatePassword(
  newPassword: string,
): Promise<AuthActionResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Пароль не короче 6 символов." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
