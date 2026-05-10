"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AttemptResult, SafeTestQuestion } from "@/app/actions/test-actions";
import { createClient } from "@/lib/supabase/server";
import type { ReviewAnswerRow } from "@/lib/learn/build-review-maps";
import type { Json } from "@/types/database.types";

const uuidSchema = z.string().uuid("Некорректный идентификатор");

export type GradebookBestAttemptDetails = {
  attemptId: string | null;
  score: number | null;
  completedAt: string | null;
  totalQuestions: number;
  /** Балл по попытке на шкале 0–10 (как в успеваемости). */
  grade10: number | null;
  /** Вопросы без `is_correct` на клиенте — как в прохождении теста. */
  questions: SafeTestQuestion[];
  /** Сводка для `QuizResultView` (как после `completeAttempt` для уже завершённой попытки). */
  resultSummary: AttemptResult | null;
  /** Строки ответов + верные option id по вопросу — для `buildReviewMaps`. */
  reviewAnswers: ReviewAnswerRow[];
  testTitle: string | null;
  testDescription: string | null;
};

export async function getBestTestAttemptDetails(
  studentId: string,
  testId: string,
): Promise<
  { success: true; data: GradebookBestAttemptDetails } | { success: false; error: string }
> {
  const sid = uuidSchema.safeParse(studentId);
  const tid = uuidSchema.safeParse(testId);
  if (!sid.success) {
    return { success: false, error: sid.error.issues[0]?.message ?? "Некорректный ID" };
  }
  if (!tid.success) {
    return { success: false, error: tid.error.issues[0]?.message ?? "Некорректный ID" };
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

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, user_id, title, description")
    .eq("id", tid.data)
    .maybeSingle();

  if (testError || !testRow) {
    return { success: false, error: "Тест не найден" };
  }

  /** Ученик смотрит только свои попытки; преподаватель — чужие в своём тесте; админ — любые. */
  const skipTestOwnershipCheck =
    profile.role === "admin" ||
    (user.id === sid.data && profile.role === "student");

  if (!skipTestOwnershipCheck) {
    if (profile.role !== "teacher" && profile.role !== "admin") {
      return { success: false, error: "Недостаточно прав" };
    }
    if (profile.role !== "admin" && testRow.user_id !== user.id) {
      return {
        success: false,
        error: "Этот тест принадлежит другому преподавателю",
      };
    }
  }

  const { data: questionsRaw, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, type, order_index, content, created_at, options ( id, content, order_index, is_correct )",
    )
    .eq("test_id", tid.data)
    .order("order_index", { ascending: true });

  if (questionsError) {
    return { success: false, error: questionsError.message };
  }

  const questionsOrdered = questionsRaw ?? [];
  const totalQuestions = questionsOrdered.length;

  const { data: attempt, error: attemptError } = await supabase
    .from("student_attempts")
    .select("id, score, completed_at, status")
    .eq("student_id", sid.data)
    .eq("test_id", tid.data)
    .eq("status", "completed")
    .order("score", { ascending: false })
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    return { success: false, error: attemptError.message };
  }

  let answerRows: {
    question_id: string;
    option_id: string | null;
    answer_data: Json | null;
  }[] = [];

  if (attempt?.id) {
    const { data: ar, error: arErr } = await supabase
      .from("attempt_answers")
      .select("question_id, option_id, answer_data")
      .eq("attempt_id", attempt.id);

    if (arErr) {
      return { success: false, error: arErr.message };
    }
    /** Все строки попытки, в т.ч. не-choice только с `answer_data` и без `option_id`. */
    answerRows = (ar ?? []) as typeof answerRows;
  }

  const questionIds = questionsOrdered.map((q) => q.id);
  const correctByQuestion = new Map<string, string[]>();
  if (questionIds.length > 0) {
    const { data: optionRows, error: optionErr } = await supabase
      .from("options")
      .select("id, question_id, is_correct")
      .in("question_id", questionIds);
    if (optionErr) {
      return { success: false, error: optionErr.message };
    }
    for (const o of optionRows ?? []) {
      if (!o.is_correct) continue;
      const list = correctByQuestion.get(o.question_id) ?? [];
      if (!list.includes(o.id)) {
        list.push(o.id);
      }
      correctByQuestion.set(o.question_id, list);
    }
  }

  const reviewAnswers: ReviewAnswerRow[] = answerRows.map((r) => ({
    question_id: r.question_id,
    option_id: typeof r.option_id === "string" && r.option_id.trim() !== "" ? r.option_id : "",
    answer_data: r.answer_data,
    correct_option_ids: correctByQuestion.get(r.question_id) ?? [],
  }));

  const grade10 =
    attempt && totalQuestions > 0
      ? Math.max(
          0,
          Math.min(10, Math.round(((attempt.score ?? 0) / totalQuestions) * 10)),
        )
      : null;

  const answeredQuestionIds = new Set(answerRows.map((r) => r.question_id));
  const answeredCount = answeredQuestionIds.size;
  const scoreVal = attempt?.score ?? 0;
  const resultSummary: AttemptResult | null = attempt
    ? {
        score: scoreVal,
        correctCount: scoreVal,
        totalQuestions,
        answeredCount,
        percentCorrect:
          totalQuestions > 0
            ? Math.round((scoreVal / totalQuestions) * 100)
            : 0,
      }
    : null;

  const questions: SafeTestQuestion[] = questionsOrdered.map((q) => {
    const rawOpts = (q.options ?? []) as {
      id: string;
      content: Json;
      order_index: number;
    }[];
    const optionsSorted = [...rawOpts].sort(
      (a, b) => a.order_index - b.order_index,
    );
    return {
      id: q.id,
      content: q.content as Json,
      order_index: q.order_index,
      type: q.type,
      created_at: q.created_at ?? null,
      options: optionsSorted.map((o) => ({
        id: o.id,
        content: o.content,
        order_index: o.order_index,
      })),
    };
  });

  return {
    success: true,
    data: {
      attemptId: attempt?.id ?? null,
      score: attempt?.score ?? null,
      completedAt: attempt?.completed_at ?? null,
      totalQuestions,
      grade10,
      questions,
      resultSummary,
      reviewAnswers,
      testTitle: testRow.title ?? null,
      testDescription: testRow.description ?? null,
    },
  };
}

const grade10OverrideSchema = z.coerce.number().int().min(0).max(10);

/**
 * Преподаватель вручную выставляет балл 0–10: пересчитывается `student_attempts.score`
 * под ту же формулу, что и при автоподсчёте (пропорция к числу вопросов).
 */
export async function overrideTestAttemptGrade(
  attemptId: string,
  grade10: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const idParsed = uuidSchema.safeParse(attemptId);
  const gradeParsed = grade10OverrideSchema.safeParse(grade10);
  if (!idParsed.success) {
    return {
      success: false,
      error: idParsed.error.issues[0]?.message ?? "Некорректный ID попытки",
    };
  }
  if (!gradeParsed.success) {
    return {
      success: false,
      error: gradeParsed.error.issues[0]?.message ?? "Оценка должна быть целым числом 0–10",
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

  if (profile.role !== "teacher" && profile.role !== "admin") {
    return { success: false, error: "Недостаточно прав" };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("student_attempts")
    .select("id, test_id, status")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.status !== "completed") {
    return { success: false, error: "Можно менять оценку только у завершённой попытки" };
  }

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, user_id")
    .eq("id", attempt.test_id)
    .maybeSingle();

  if (testError || !testRow) {
    return { success: false, error: "Тест не найден" };
  }

  if (profile.role !== "admin" && testRow.user_id !== user.id) {
    return { success: false, error: "Этот тест принадлежит другому преподавателю" };
  }

  const { data: questionRows, error: qErr } = await supabase
    .from("questions")
    .select("id")
    .eq("test_id", attempt.test_id);

  if (qErr) {
    return { success: false, error: qErr.message };
  }

  const total = (questionRows ?? []).length;
  const newScore =
    total > 0
      ? Math.max(0, Math.min(total, Math.round((gradeParsed.data / 10) * total)))
      : 0;

  const { error: updateError } = await supabase
    .from("student_attempts")
    .update({ score: newScore })
    .eq("id", idParsed.data);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/learn");
  return { success: true };
}
