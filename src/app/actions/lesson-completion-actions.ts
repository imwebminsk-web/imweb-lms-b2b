"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const lessonIdSchema = z.string().uuid("Некорректный ID урока");

/**
 * Есть ли у текущего пользователя отметка «урок завершён» для этого урока.
 */
export async function getLessonCompletionStatus(
  lessonId: string,
): Promise<boolean> {
  const parsed = lessonIdSchema.safeParse(lessonId);
  if (!parsed.success) {
    return false;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("lesson_completions")
    .select("id")
    .eq("lesson_id", parsed.data)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getLessonCompletionStatus]", error.message);
    return false;
  }

  return data != null;
}

export type ToggleLessonCompletionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Переключает отметку завершения: при наличии строки — удаляет, иначе — создаёт.
 */
export async function toggleLessonCompletion(
  lessonId: string,
  pathname: string,
): Promise<ToggleLessonCompletionResult> {
  const parsedLesson = lessonIdSchema.safeParse(lessonId);
  if (!parsedLesson.success) {
    return {
      ok: false,
      error: parsedLesson.error.issues[0]?.message ?? "Некорректный ID",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Требуется вход в систему" };
  }

  const { data: existing, error: selectError } = await supabase
    .from("lesson_completions")
    .select("id")
    .eq("lesson_id", parsedLesson.data)
    .eq("student_id", user.id)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("lesson_completions")
      .delete()
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("lesson_completions").insert({
      lesson_id: parsedLesson.data,
      student_id: user.id,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(pathname);
  return { ok: true };
}
