"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SignUpState = {
  error?: string;
};

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
