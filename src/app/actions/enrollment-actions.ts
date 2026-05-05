"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type JoinCohortByPinState = {
  error?: string;
  success?: boolean;
  redirectUrl?: string;
};

type RpcPayload = {
  ok?: boolean;
  slug?: string;
  code?: string;
};

function parseRpcPayload(raw: unknown): RpcPayload {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    ok: typeof o.ok === "boolean" ? o.ok : undefined,
    slug: typeof o.slug === "string" ? o.slug : undefined,
    code: typeof o.code === "string" ? o.code : undefined,
  };
}

/**
 * Запись студента в курс по PIN когорты (логика в RPC `join_cohort_by_pin` из‑за RLS).
 */
export async function joinCohortByPin(
  _prev: JoinCohortByPinState,
  formData: FormData,
): Promise<JoinCohortByPinState> {
  const pinRaw = String(formData.get("pin") ?? "");
  const pin = pinRaw.toUpperCase().trim().replace(/\s+/g, "");

  if (!pin) {
    return { error: "Введите PIN-код группы." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Профиль не найден." };
  }

  if (profile.role !== "student") {
    return { error: "Присоединение по PIN доступно только ученикам." };
  }

  const { data: rpcRaw, error: rpcError } = await supabase.rpc(
    "join_cohort_by_pin",
    { p_pin: pin },
  );

  if (rpcError) {
    console.error("[joinCohortByPin]", rpcError.message);
    return { error: rpcError.message || "Не удалось выполнить запись." };
  }

  const payload = parseRpcPayload(rpcRaw);

  if (!payload.ok) {
    switch (payload.code) {
      case "invalid_pin":
        return { error: "PIN должен быть 6 символов (латиница A–Z и цифры)." };
      case "not_found":
        return { error: "Неверный или неактивный код доступа" };
      case "already_same":
        return { error: "Вы уже состоите в этой группе" };
      case "already_other_cohort":
        return {
          error:
            "Вы уже записаны на этот курс в другой группе. Обратитесь к преподавателю.",
        };
      case "unauthorized":
        return { error: "Нужна авторизация." };
      case "course_not_published":
        return {
          error:
            "Этот курс ещё не опубликован. Дождитесь открытия доступа от преподавателя.",
        };
      default:
        return { error: "Не удалось присоединиться к группе." };
    }
  }

  const slug = payload.slug?.trim();
  if (!slug) {
    return { error: "Курс не найден после записи." };
  }

  const redirectUrl = `/learn/${encodeURIComponent(slug)}`;

  revalidatePath("/dashboard");
  revalidatePath(redirectUrl);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`);

  return { success: true, redirectUrl };
}
