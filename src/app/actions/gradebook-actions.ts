"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const uuidSchema = z.string().uuid("Некорректный идентификатор");

function setsOfStringsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) {
    if (!sa.has(x)) return false;
  }
  return true;
}

function textFromQuestionContent(content: Json, type: string | null): string {
  if (type === "fill_in_the_blanks") {
    return "Заполните пропуски (тип вопроса)";
  }
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const parts = content
      .map((node) => {
        if (!node || typeof node !== "object") return "";
        const rec = node as { text?: unknown; children?: unknown };
        if (typeof rec.text === "string") return rec.text;
        if (Array.isArray(rec.children)) {
          return rec.children
            .map((child) => {
              if (!child || typeof child !== "object") return "";
              const c = child as { text?: unknown };
              return typeof c.text === "string" ? c.text : "";
            })
            .join("");
        }
        return "";
      })
      .join("")
      .trim();
    if (parts) return parts;
    return "Вопрос";
  }

  if (content && typeof content === "object") {
    const rec = content as { text?: unknown; children?: unknown };
    if (typeof rec.text === "string") return rec.text;
    if (Array.isArray(rec.children)) {
      const parts = rec.children
        .map((child) => {
          if (!child || typeof child !== "object") return "";
          const c = child as { text?: unknown };
          return typeof c.text === "string" ? c.text : "";
        })
        .join("")
        .trim();
      if (parts) return parts;
    }
  }
  return "Вопрос";
}

function textFromOptionContent(content: Json): string {
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    "text" in content &&
    typeof (content as { text: unknown }).text === "string"
  ) {
    return (content as { text: string }).text;
  }
  return typeof content === "string" ? content : String(content ?? "");
}

function expandPickedOptionIdsFromAnswerRow(
  row: { option_id: string; answer_data: Json | null },
  questionType: string | null,
): string[] {
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";
  if (
    isMultiple &&
    row.answer_data &&
    typeof row.answer_data === "object" &&
    !Array.isArray(row.answer_data)
  ) {
    const raw = (row.answer_data as { selectedOptionIds?: unknown })
      .selectedOptionIds;
    if (Array.isArray(raw)) {
      const ids = raw.filter((x): x is string => typeof x === "string");
      if (ids.length > 0) return [...new Set(ids)];
    }
  }
  return [row.option_id];
}

function isClassicChoiceQuestion(type: string | null): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "multiple" ||
    type === "single"
  );
}

export type GradebookTestOptionReview = {
  id: string;
  label: string;
  orderIndex: number;
  isCorrect: boolean;
  isPicked: boolean;
};

export type GradebookTestQuestionReview = {
  questionId: string;
  orderIndex: number;
  type: string | null;
  questionText: string;
  /** Для single/multiple choice — список вариантов с подсветкой. */
  options: GradebookTestOptionReview[];
  /** Для пазлов, подписей, пропусков и т.п. */
  nonChoiceAnswerSummary: string | null;
  /** Верно ли зачтён ответ (для choice — по множествам верных id). */
  questionCorrect: boolean | null;
};

export type GradebookBestAttemptDetails = {
  attemptId: string | null;
  score: number | null;
  completedAt: string | null;
  totalQuestions: number;
  percent: number | null;
  questions: GradebookTestQuestionReview[];
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
    .select("id, user_id")
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
      "id, type, order_index, content, options ( id, content, order_index, is_correct )",
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
    option_id: string;
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
    answerRows = ar ?? [];
  }

  const answersByQuestion = new Map<
    string,
    { option_id: string; answer_data: Json | null }[]
  >();
  for (const r of answerRows) {
    const list = answersByQuestion.get(r.question_id) ?? [];
    list.push({ option_id: r.option_id, answer_data: r.answer_data });
    answersByQuestion.set(r.question_id, list);
  }

  const percent =
    attempt && totalQuestions > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(((attempt.score ?? 0) / totalQuestions) * 100)),
        )
      : null;

  const questions: GradebookTestQuestionReview[] = questionsOrdered.map((q) => {
    const type = q.type;
    const questionText = textFromQuestionContent(q.content as Json, type);
    const rows = answersByQuestion.get(q.id) ?? [];
    const picked = new Set<string>();
    for (const row of rows) {
      for (const id of expandPickedOptionIdsFromAnswerRow(row, type)) {
        picked.add(id);
      }
    }

    const rawOpts = (q.options ?? []) as {
      id: string;
      content: Json;
      order_index: number;
      is_correct: boolean | null;
    }[];

    const optionsSorted = [...rawOpts].sort(
      (a, b) => a.order_index - b.order_index,
    );

    const correctIds = optionsSorted
      .filter((o) => o.is_correct === true)
      .map((o) => o.id);
    const pickedArr = [...picked];

    let nonChoiceAnswerSummary: string | null = null;
    if (!isClassicChoiceQuestion(type)) {
      if (rows.length === 0) {
        nonChoiceAnswerSummary = attempt ? "Ответ не сохранён" : null;
      } else {
        nonChoiceAnswerSummary = rows
          .map((r) => JSON.stringify(r.answer_data ?? r.option_id))
          .join("\n");
      }
    }

    let questionCorrect: boolean | null = null;
    if (isClassicChoiceQuestion(type) && correctIds.length > 0) {
      const pickedUnique = [...new Set(pickedArr)];
      questionCorrect = setsOfStringsEqual(pickedUnique, correctIds);
    } else if (!isClassicChoiceQuestion(type) && attempt) {
      questionCorrect = null;
    }

    const options: GradebookTestOptionReview[] = optionsSorted.map((o) => ({
      id: o.id,
      label: textFromOptionContent(o.content),
      orderIndex: o.order_index,
      isCorrect: o.is_correct === true,
      isPicked: picked.has(o.id),
    }));

    return {
      questionId: q.id,
      orderIndex: q.order_index,
      type,
      questionText,
      options,
      nonChoiceAnswerSummary,
      questionCorrect,
    };
  });

  return {
    success: true,
    data: {
      attemptId: attempt?.id ?? null,
      score: attempt?.score ?? null,
      completedAt: attempt?.completed_at ?? null,
      totalQuestions,
      percent,
      questions,
    },
  };
}
