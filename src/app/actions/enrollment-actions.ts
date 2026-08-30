"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyAccess } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

const GENERIC_PIN_ERROR = "Неверный PIN-код или группа недоступна";

export type JoinCohortByPinResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

const pinSchema = z
  .string()
  .transform((value) => value.toUpperCase().trim().replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Введите PIN-код группы.")
      .regex(
        /^[A-Z0-9]{6}$/,
        "PIN должен быть 6 символов (латиница A–Z и цифры).",
      ),
  );

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

function mapRpcBusinessError(code: string | undefined): string {
  switch (code) {
    case "invalid_pin":
    case "not_found":
    case "course_not_published":
      return GENERIC_PIN_ERROR;
    case "already_same":
      return "Вы уже состоите в этой группе";
    case "already_other_cohort":
      return "Вы уже записаны на этот курс в другой группе. Обратитесь к преподавателю.";
    case "unauthorized":
      return "Нужна авторизация.";
    case "suspended":
      return "Доступ приостановлен";
    default:
      return GENERIC_PIN_ERROR;
  }
}

/**
 * Запись студента в курс по PIN когорты (логика в RPC `join_cohort_by_pin` из‑за RLS).
 */
export async function joinCohortByPin(
  pin: string,
): Promise<JoinCohortByPinResult> {
  await verifyAccess(["student"]);

  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Введите PIN-код группы.",
    };
  }

  // Замедляет перебор PIN: каждая попытка занимает минимум 1 секунду.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    const supabase = await createClient();
    const { data: rpcRaw, error: rpcError } = await supabase.rpc(
      "join_cohort_by_pin",
      { p_pin: parsed.data },
    );

    if (rpcError) {
      console.error("[joinCohortByPin]", rpcError.message);
      return { ok: false, error: GENERIC_PIN_ERROR };
    }

    const payload = parseRpcPayload(rpcRaw);

    if (payload.code === "pending_approval") {
      revalidatePath("/dashboard");
      return { ok: true, redirectUrl: "/dashboard" };
    }

    if (!payload.ok) {
      return { ok: false, error: mapRpcBusinessError(payload.code) };
    }

    const slug = payload.slug?.trim();
    if (!slug) {
      return { ok: false, error: GENERIC_PIN_ERROR };
    }

    const redirectUrl = `/learn/${encodeURIComponent(slug)}`;

    revalidatePath("/dashboard");
    revalidatePath(redirectUrl);
    revalidatePath(`/learn/${encodeURIComponent(slug)}`);

    return { ok: true, redirectUrl };
  } catch (err) {
    console.error("[joinCohortByPin]", err);
    return { ok: false, error: GENERIC_PIN_ERROR };
  }
}
