"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { z } from "zod";

const attemptIdSchema = z.string().uuid("Некорректный ID попытки");
const testIdSchema = z.string().uuid("Некорректный ID теста");

const studentAnswerSchema = z.object({
  question_id: z.string().uuid("Некорректный ID вопроса"),
  option_ids: z.array(z.string().uuid()).optional().default([]),
  answer_data: z.unknown().optional(),
});

const studentAnswersSchema = z.array(studentAnswerSchema);

type StudentAnswer = z.infer<typeof studentAnswerSchema>;

export async function startTestAttempt(
  testId: string,
): Promise<
  | { success: true; attemptId: string; resumed: boolean }
  | { success: false; error: string }
> {
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

  const { data: existingAttempt, error: existingError } = await supabase
    .from("student_attempts")
    .select("id")
    .eq("student_id", user.id)
    .eq("test_id", parsed.data)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  if (existingAttempt?.id) {
    return { success: true, attemptId: existingAttempt.id, resumed: true };
  }

  const { data: createdAttempt, error: createError } = await supabase
    .from("student_attempts")
    .insert({
      student_id: user.id,
      test_id: parsed.data,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError || !createdAttempt) {
    return {
      success: false,
      error: createError?.message ?? "Не удалось создать попытку",
    };
  }

  return { success: true, attemptId: createdAttempt.id, resumed: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = normalizeJson(value[key]);
  }
  return out;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeJson(a)) === JSON.stringify(normalizeJson(b));
}

function normalizeIdSet(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function equalIdSets(a: string[], b: string[]): boolean {
  const aa = normalizeIdSet(a);
  const bb = normalizeIdSet(b);
  if (aa.length !== bb.length) return false;
  return aa.every((id, i) => id === bb[i]);
}

function parsePuzzlePairsFromAnswerData(
  answerData: unknown,
): { leftOptionId: string; rightOptionId: string }[] | null {
  if (!isPlainObject(answerData)) return null;
  const raw = answerData.pairs ?? answerData.matchingPairs;
  if (!Array.isArray(raw)) return null;
  const pairs: { leftOptionId: string; rightOptionId: string }[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return null;
    const left = item.leftOptionId;
    const right = item.rightOptionId;
    if (typeof left !== "string" || typeof right !== "string") return null;
    pairs.push({ leftOptionId: left, rightOptionId: right });
  }
  return pairs;
}

function isCorrectPuzzleAnswer(optionIds: string[], answerData: unknown): boolean {
  const pairs = parsePuzzlePairsFromAnswerData(answerData);
  if (!pairs || optionIds.length === 0 || pairs.length !== optionIds.length) {
    return false;
  }
  const validSet = new Set(optionIds);
  const leftUsed = new Set<string>();
  const rightUsed = new Set<string>();
  for (const pair of pairs) {
    if (!validSet.has(pair.leftOptionId) || !validSet.has(pair.rightOptionId)) {
      return false;
    }
    if (leftUsed.has(pair.leftOptionId) || rightUsed.has(pair.rightOptionId)) {
      return false;
    }
    leftUsed.add(pair.leftOptionId);
    rightUsed.add(pair.rightOptionId);
    if (pair.leftOptionId !== pair.rightOptionId) {
      return false;
    }
  }
  return leftUsed.size === validSet.size && rightUsed.size === validSet.size;
}

function isCorrectFillInTheBlanksAnswer(
  questionContent: Json | null,
  answerData: unknown,
): boolean {
  if (!isPlainObject(questionContent) || !isPlainObject(answerData)) return false;
  const correctMapping = questionContent.correctMapping;
  const fillAssignments = answerData.fillAssignments;
  if (!isPlainObject(correctMapping) || !isPlainObject(fillAssignments)) return false;
  return deepEqualJson(correctMapping, fillAssignments);
}

function evaluateQuestion(
  question: {
    id: string;
    type: string | null;
    content: Json;
    options: { id: string; is_correct: boolean }[];
  },
  studentAnswer: StudentAnswer | undefined,
): boolean {
  if (!studentAnswer) return false;

  const questionType = question.type;
  const selectedOptionIds = normalizeIdSet(studentAnswer.option_ids ?? []);
  const correctOptionIds = normalizeIdSet(
    question.options.filter((o) => o.is_correct).map((o) => o.id),
  );

  if (questionType === "single_choice" || questionType === "multiple_choice") {
    return equalIdSets(selectedOptionIds, correctOptionIds);
  }

  if (questionType === "matching_puzzle" || questionType === "dnd_puzzle") {
    return isCorrectPuzzleAnswer(
      question.options.map((o) => o.id),
      studentAnswer.answer_data,
    );
  }

  if (questionType === "fill_in_the_blanks") {
    return isCorrectFillInTheBlanksAnswer(question.content, studentAnswer.answer_data);
  }

  // TODO: Для image_labeling и других интерактивных типов добавить специализированный парсер/проверку.
  return false;
}

export async function submitTestAttempt(
  attemptId: string,
  studentAnswers: unknown[],
): Promise<{ success: true; score: number } | { success: false; error: string }> {
  const attemptParsed = attemptIdSchema.safeParse(attemptId);
  if (!attemptParsed.success) {
    return { success: false, error: attemptParsed.error.issues[0]?.message ?? "Некорректный ID попытки" };
  }

  const answersParsed = studentAnswersSchema.safeParse(studentAnswers);
  if (!answersParsed.success) {
    return { success: false, error: answersParsed.error.issues[0]?.message ?? "Некорректный формат ответов" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("student_attempts")
    .select("id, student_id, test_id, status")
    .eq("id", attemptParsed.data)
    .single();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }
  if (attempt.student_id !== user.id) {
    return { success: false, error: "Нет доступа к этой попытке" };
  }
  if (attempt.status === "completed") {
    return { success: false, error: "Попытка уже завершена" };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, type, content, options(id, is_correct)")
    .eq("test_id", attempt.test_id)
    .order("order_index", { ascending: true });

  if (questionsError) {
    return { success: false, error: questionsError.message };
  }

  const questionRows = questions ?? [];
  if (questionRows.length === 0) {
    return { success: false, error: "В тесте нет вопросов" };
  }

  const answerByQuestion = new Map(
    answersParsed.data.map((a) => [a.question_id, a] as const),
  );

  const validQuestionIds = new Set(questionRows.map((q) => q.id));
  for (const answer of answersParsed.data) {
    if (!validQuestionIds.has(answer.question_id)) {
      return {
        success: false,
        error: "Обнаружен ответ на вопрос, который не относится к этой попытке",
      };
    }
  }

  let earnedScore = 0;
  const maxScore = questionRows.length;

  for (const question of questionRows) {
    const isCorrect = evaluateQuestion(
      {
        id: question.id,
        type: question.type,
        content: question.content,
        options: (question.options ?? []).map((o) => ({
          id: o.id,
          is_correct: o.is_correct ?? false,
        })),
      },
      answerByQuestion.get(question.id),
    );
    if (isCorrect) {
      earnedScore += 1;
    }
  }

  const finalScore = Math.round((earnedScore / Math.max(maxScore, 1)) * 100);

  const upsertRows = questionRows.map((question) => {
    const answer = answerByQuestion.get(question.id);
    const options = question.options ?? [];
    const validOptionIds = new Set(options.map((o) => o.id));
    const selected = (answer?.option_ids ?? []).filter((id) => validOptionIds.has(id));
    const fallbackOptionId = options[0]?.id;
    const optionId = selected[0] ?? fallbackOptionId;

    if (!optionId) {
      throw new Error(`У вопроса ${question.id} нет доступных вариантов ответа`);
    }

    return {
      attempt_id: attempt.id,
      question_id: question.id,
      option_id: optionId,
      answer_data: (answer?.answer_data ?? null) as Json | null,
    };
  });

  const { error: upsertError } = await supabase
    .from("attempt_answers")
    .upsert(upsertRows, { onConflict: "attempt_id,question_id" });

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  const { error: updateError } = await supabase
    .from("student_attempts")
    .update({
      score: finalScore,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, score: finalScore };
}
