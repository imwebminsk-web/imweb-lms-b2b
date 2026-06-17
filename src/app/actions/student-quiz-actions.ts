"use server";

import { z } from "zod";

import {
  getTestWithQuestions,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import { createClient } from "@/lib/supabase/server";

const testIdSchema = z.string().uuid("Некорректный ID теста");

export type InitStudentQuizSuccess = {
  success: true;
  test: { title: string; description: string | null; isForKids: boolean; timeLimitMinutes: number };
  questions: SafeTestQuestion[];
  attemptId: string;
};

export type InitStudentQuizResult =
  | InitStudentQuizSuccess
  | { success: false; error: string };

function resolveStudentTestType(testType: string | null | undefined): "training" | "final" {
  return testType === "training" ? "training" : "final";
}

/**
 * Подготовка прохождения теста учеником: данные теста + попытка `in_progress`.
 * Тренировочный тест: при новом старте удаляются прошлые попытки (ответы — каскадом).
 * Итоговый тест: только одна попытка; черновик `in_progress` можно продолжить.
 */
export async function initStudentQuiz(
  testId: string,
): Promise<InitStudentQuizResult> {
  const parsed = testIdSchema.safeParse(testId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID теста",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден" };
  }

  if (profile.role !== "student") {
    return { success: false, error: "Доступно только ученикам" };
  }

  const testRes = await getTestWithQuestions(parsed.data);
  if (!testRes.success) {
    return { success: false, error: testRes.error };
  }

  const { data } = testRes;
  if (!data.is_published) {
    return { success: false, error: "Тест недоступен" };
  }

  const testType = resolveStudentTestType(data.test_type);
  const isTrainingTest = testType === "training";

  const { data: existingRows, error: findError } = await supabase
    .from("student_attempts")
    .select("id")
    .eq("student_id", user.id)
    .eq("test_id", parsed.data)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (findError) {
    return { success: false, error: findError.message };
  }

  let attemptId = existingRows?.[0]?.id;

  if (!attemptId) {
    if (!isTrainingTest) {
      const { data: priorAttempts, error: priorError } = await supabase
        .from("student_attempts")
        .select("id")
        .eq("student_id", user.id)
        .eq("test_id", parsed.data)
        .limit(1);

      if (priorError) {
        return { success: false, error: priorError.message };
      }

      if ((priorAttempts ?? []).length > 0) {
        return {
          success: false,
          error: "Этот тест можно пройти только один раз.",
        };
      }
    } else {
      const { error: deleteError } = await supabase
        .from("student_attempts")
        .delete()
        .eq("student_id", user.id)
        .eq("test_id", parsed.data);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }
    }

    const { data: row, error: insertError } = await supabase
      .from("student_attempts")
      .insert({
        student_id: user.id,
        test_id: parsed.data,
        status: "in_progress",
        score: 0,
        started_at: new Date().toISOString(),
        is_training_mode: isTrainingTest,
      })
      .select("id")
      .single();

    if (!insertError && row?.id) {
      attemptId = row.id;
    } else {
      const isDuplicate =
        insertError?.code === "23505" ||
        (insertError?.message?.toLowerCase().includes("duplicate") ?? false);

      if (isDuplicate) {
        const { data: again, error: againError } = await supabase
          .from("student_attempts")
          .select("id")
          .eq("student_id", user.id)
          .eq("test_id", parsed.data)
          .eq("status", "in_progress")
          .order("started_at", { ascending: false, nullsFirst: false })
          .limit(1);

        if (againError) {
          return { success: false, error: againError.message };
        }
        attemptId = again?.[0]?.id;
      }

      if (!attemptId) {
        return {
          success: false,
          error: insertError?.message ?? "Не удалось начать попытку",
        };
      }
    }
  }

  return {
    success: true,
    test: {
      title: data.title,
      description: data.description,
      isForKids: data.is_for_kids ?? false,
      timeLimitMinutes: data.time_limit ?? 0,
    },
    questions: data.questions,
    attemptId,
  };
}
