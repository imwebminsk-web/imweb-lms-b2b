"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type SignUpState = {
  error?: string;
};

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

const emailSchema = z.string().trim().email("Укажите корректный email.");
const passwordSchema = z.string().min(6, "Пароль не короче 6 символов.");

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
    console.error("[signUp]", error.message);
    return { ...initial, error: "Не удалось создать аккаунт. Попробуйте снова." };
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
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Укажите email.",
    };
  }

  try {
    const origin = await getRequestOrigin();
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      console.error("[requestPasswordReset]", error.message);
    }

    // Не раскрываем, существует ли аккаунт с этим email.
    return { ok: true };
  } catch (err) {
    console.error("[requestPasswordReset]", err);
    return {
      ok: false,
      error: "Не удалось отправить ссылку. Попробуйте снова.",
    };
  }
}

/** Устанавливает новый пароль для текущей recovery-сессии. */
export async function updatePassword(
  newPassword: string,
): Promise<AuthActionResult> {
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Пароль не короче 6 символов.",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data,
    });

    if (error) {
      console.error("[updatePassword]", error.message);
      return {
        ok: false,
        error: "Не удалось обновить пароль. Попробуйте ещё раз.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[updatePassword]", err);
    return {
      ok: false,
      error: "Не удалось обновить пароль. Попробуйте ещё раз.",
    };
  }
}
