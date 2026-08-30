"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  isLessonCompletionBlocked,
  resolveLessonCompletionGate,
  type LessonCompletionGate,
} from "@/lib/learn/lesson-final-test-gate";
import { verifyAccess } from "@/lib/auth/rbac";
import { assertEnrolledForLesson } from "@/lib/learn/verify-course-enrollment";
import { createClient } from "@/lib/supabase/server";

export type { LessonCompletionGate } from "@/lib/learn/lesson-final-test-gate";

const lessonIdSchema = z.string().uuid("Некорректный ID урока");
const userIdSchema = z.string().uuid("Некорректный ID пользователя");

const LESSON_COMPLETION_GATE_ERROR =
  "Cannot complete lesson: required tests or assignments are not finished.";
const GENERIC_PROGRESS_ERROR = "Не удалось обновить прогресс урока";

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

/**
 * Можно ли отметить урок завершённым: итоговые тесты сданы
 * и обязательные задания приняты преподавателем.
 */
export async function getLessonCompletionGate(
  lessonId: string,
  userId: string,
): Promise<LessonCompletionGate> {
  const parsedLesson = lessonIdSchema.safeParse(lessonId);
  const parsedUser = userIdSchema.safeParse(userId);
  if (!parsedLesson.success || !parsedUser.success) {
    return { state: "blocked_not_passed" };
  }

  const supabase = await createClient();
  const state = await resolveLessonCompletionGate(
    supabase,
    parsedLesson.data,
    parsedUser.data,
  );
  return { state };
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
  const { user } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
    "student",
  ]);

  const parsedLesson = lessonIdSchema.safeParse(lessonId);
  if (!parsedLesson.success) {
    return {
      ok: false,
      error: parsedLesson.error.issues[0]?.message ?? "Некорректный ID",
    };
  }

  const enrollment = await assertEnrolledForLesson(user.id, parsedLesson.data);
  if (!enrollment.ok) {
    return { ok: false, error: enrollment.error };
  }

  try {
    const supabase = await createClient();
    const { data: existing, error: selectError } = await supabase
      .from("lesson_completions")
      .select("id")
      .eq("lesson_id", parsedLesson.data)
      .eq("student_id", user.id)
      .maybeSingle();

    if (selectError) {
      console.error("[toggleLessonCompletion]", selectError.message);
      return { ok: false, error: GENERIC_PROGRESS_ERROR };
    }

    if (existing) {
      const { error } = await supabase
        .from("lesson_completions")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[toggleLessonCompletion]", error.message);
        return { ok: false, error: GENERIC_PROGRESS_ERROR };
      }
    } else {
      const gateState = await resolveLessonCompletionGate(
        supabase,
        parsedLesson.data,
        user.id,
      );
      if (isLessonCompletionBlocked(gateState)) {
        return { ok: false, error: LESSON_COMPLETION_GATE_ERROR };
      }

      const { error } = await supabase.from("lesson_completions").insert({
        lesson_id: parsedLesson.data,
        student_id: user.id,
      });

      if (error) {
        console.error("[toggleLessonCompletion]", error.message);
        return { ok: false, error: GENERIC_PROGRESS_ERROR };
      }
    }

    revalidatePath(pathname);
    return { ok: true };
  } catch (err) {
    console.error("[toggleLessonCompletion]", err);
    return { ok: false, error: GENERIC_PROGRESS_ERROR };
  }
}
