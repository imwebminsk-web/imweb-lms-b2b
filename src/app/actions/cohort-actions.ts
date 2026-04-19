"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const PIN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PIN_LENGTH = 6;
const PIN_INSERT_MAX_ATTEMPTS = 10;

export type CreateCohortResult =
  | { success: true; pinCode: string; cohortId: string }
  | { success: false; error: string };

function generatePinCode(): string {
  let pin = "";
  for (let i = 0; i < PIN_LENGTH; i += 1) {
    pin += PIN_ALPHABET[randomInt(PIN_ALPHABET.length)]!;
  }
  return pin;
}

/**
 * Создаёт группу по курсу с уникальным PIN (6 символов A–Z и цифры).
 * Повторяет вставку при коллизии UNIQUE(pin_code).
 */
export async function createCohort(
  courseId: string,
  name: string,
): Promise<CreateCohortResult> {
  const cid = courseId.trim();
  const groupName = name.trim();

  if (!cid) {
    return { success: false, error: "Не выбран курс." };
  }
  if (!groupName) {
    return { success: false, error: "Введите название группы." };
  }
  if (groupName.length > 200) {
    return { success: false, error: "Название не длиннее 200 символов." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cid)
    .maybeSingle();

  if (courseError || !course) {
    return { success: false, error: "Курс не найден." };
  }

  if (course.teacher_id !== user.id) {
    return { success: false, error: "Нет прав на создание группы для этого курса." };
  }

  for (let attempt = 0; attempt < PIN_INSERT_MAX_ATTEMPTS; attempt += 1) {
    const pin_code = generatePinCode();
    const { data: inserted, error: insertError } = await supabase
      .from("cohorts")
      .insert({
        course_id: cid,
        name: groupName,
        pin_code,
        is_active: true,
      })
      .select("id")
      .single();

    if (!insertError && inserted) {
      revalidatePath("/dashboard/cohorts");
      return { success: true, pinCode: pin_code, cohortId: inserted.id };
    }

    const msg = insertError?.message ?? "";
    if (
      msg.includes("cohorts_pin_code_key") ||
      msg.includes("duplicate key") ||
      msg.includes("unique constraint")
    ) {
      continue;
    }

    console.error("[createCohort]", msg);
    return {
      success: false,
      error: insertError?.message || "Не удалось создать группу.",
    };
  }

  return {
    success: false,
    error: "Не удалось сгенерировать уникальный PIN. Попробуйте ещё раз.",
  };
}
