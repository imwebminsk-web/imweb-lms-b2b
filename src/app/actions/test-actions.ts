"use server";

import { revalidatePath } from "next/cache";
import {
  parseFillAssignmentsFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import { createClient } from "@/lib/supabase/server";
import {
  saveFullTestPayloadSchema,
  type SaveFullTestPayload,
} from "@/lib/validations/admin-test-schema";
import {
  FillInTheBlanksContentSchema,
  type FillInTheBlanksContent,
} from "@/lib/validations/fill-in-the-blanks-schema";
import {
  submitAnswerSchema,
  type SubmitAnswerInput,
} from "@/lib/validations/test-schemas";
import type {
  CreateTestFormInitialData,
  QuestionField,
} from "@/types/create-test-form";
import type { Database, Json, Tables } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const matchingPairArraySchema = z.array(
  z.object({
    leftOptionId: z.string().uuid(),
    rightOptionId: z.string().uuid(),
  }),
);

const matchingAnswerPayloadSchema = z.object({
  matchingPairs: matchingPairArraySchema,
});

const dndPuzzleAnswerPayloadSchema = z.object({
  pairs: matchingPairArraySchema,
});

const imageLabelingAnswerPayloadSchema = z.object({
  labelPairs: z.array(
    z.object({
      imageId: z.string().uuid(),
      wordId: z.string().uuid(),
    }),
  ),
});

const fillInTheBlanksAnswerPayloadSchema = z.object({
  fillAssignments: z.record(z.string(), z.string()),
});

/** Пара в одной строке: `imageUrl` + эталонная подпись (`correctText` или `correctWord`). */
function isImageLabelingPairRow(content: Json | null): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  const rec = content as Record<string, unknown>;
  const imageUrl = rec.imageUrl;
  const correct =
    typeof rec.correctText === "string"
      ? rec.correctText
      : typeof rec.correctWord === "string"
        ? rec.correctWord
        : "";
  return (
    typeof imageUrl === "string" &&
    imageUrl.length > 0 &&
    correct.length > 0
  );
}

/** Старый формат: отдельные строки с картинкой и со словом. */
function partitionImageLabelingOptionIdsLegacy(
  rows: { id: string; content: Json | null }[],
): { imageIds: Set<string>; wordIds: Set<string> } {
  const imageIds = new Set<string>();
  const wordIds = new Set<string>();
  for (const o of rows) {
    const c = o.content;
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const rec = c as Record<string, unknown>;
    if (isImageLabelingPairRow(c)) continue;
    if (typeof rec.imageUrl === "string" && rec.imageUrl.length > 0) {
      imageIds.add(o.id);
      continue;
    }
    const t = rec.labelText ?? rec.text;
    if (typeof t === "string" && t.length > 0) wordIds.add(o.id);
  }
  return { imageIds, wordIds };
}

function getImageLabelingPairOptionIds(
  rows: { id: string; content: Json | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const o of rows) {
    if (isImageLabelingPairRow(o.content)) ids.add(o.id);
  }
  return ids;
}

function validateImageLabelingPairs(
  pairs: { imageId: string; wordId: string }[],
  imageIds: Set<string>,
  wordIds: Set<string>,
): boolean {
  if (pairs.length !== imageIds.size || imageIds.size === 0) return false;
  const imgUsed = new Set<string>();
  const wordUsed = new Set<string>();
  for (const p of pairs) {
    if (!imageIds.has(p.imageId) || !wordIds.has(p.wordId)) return false;
    if (imgUsed.has(p.imageId) || wordUsed.has(p.wordId)) return false;
    imgUsed.add(p.imageId);
    wordUsed.add(p.wordId);
  }
  return imgUsed.size === imageIds.size && wordUsed.size === pairs.length;
}

/** Новая модель: и слот картинки, и фишка слова идентифицируются одним `option.id`. */
function validateImageLabelingPairsPairedMode(
  pairs: { imageId: string; wordId: string }[],
  pairIds: Set<string>,
): boolean {
  return validateImageLabelingPairs(pairs, pairIds, pairIds);
}

function validateMatchingPairsStructure(
  pairs: { leftOptionId: string; rightOptionId: string }[],
  validIds: Set<string>,
): boolean {
  if (pairs.length !== validIds.size || validIds.size === 0) {
    return false;
  }
  const leftUsed = new Set<string>();
  const rightUsed = new Set<string>();
  for (const p of pairs) {
    if (!validIds.has(p.leftOptionId) || !validIds.has(p.rightOptionId)) {
      return false;
    }
    if (leftUsed.has(p.leftOptionId) || rightUsed.has(p.rightOptionId)) {
      return false;
    }
    leftUsed.add(p.leftOptionId);
    rightUsed.add(p.rightOptionId);
  }
  return leftUsed.size === validIds.size && rightUsed.size === validIds.size;
}

/** Читает пары из `answer_data`: сначала `pairs` (dnd_puzzle), затем `matchingPairs`. */
function parsePairAssignmentsFromAnswerData(
  data: Json | null,
): { leftOptionId: string; rightOptionId: string }[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const raw =
    (data as { pairs?: unknown }).pairs ??
    (data as { matchingPairs?: unknown }).matchingPairs;
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: { leftOptionId: string; rightOptionId: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const l = (item as { leftOptionId?: unknown }).leftOptionId;
    const r = (item as { rightOptionId?: unknown }).rightOptionId;
    if (typeof l !== "string" || typeof r !== "string") {
      return null;
    }
    out.push({ leftOptionId: l, rightOptionId: r });
  }
  return out;
}

const testIdSchema = z.string().uuid("Некорректный ID теста");
const attemptIdSchema = z.string().uuid("Некорректный ID попытки");

/** Вариант ответа без `is_correct` — такой набор уходит на клиент. */
export type SafeTestOption = Pick<
  Tables<"options">,
  "id" | "content" | "order_index"
>;

export type SafeTestQuestion = Pick<
  Tables<"questions">,
  "id" | "content" | "order_index" | "type" | "created_at"
> & {
  options: SafeTestOption[];
};

export type TestWithQuestionsPayload = Pick<
  Tables<"tests">,
  "id" | "title" | "description" | "created_at" | "is_published"
> & {
  questions: SafeTestQuestion[];
};

export type SafeTestForClientPayload = TestWithQuestionsPayload;

export type TestListItem = Pick<
  Tables<"tests">,
  "id" | "title" | "description"
>;

export type TestListUserStatus = "not_started" | "in_progress" | "completed";

/** Элемент каталога с прогрессом текущего пользователя по попыткам. */
export type TestListItemEnriched = TestListItem & {
  totalQuestions: number;
  userStatus: TestListUserStatus;
  /** Максимум `score` среди завершённых попыток (число верных ответов). */
  bestScore: number | null;
  hasCompletedAttempt: boolean;
};

/**
 * Список тестов и сводка по `student_attempts` для текущего пользователя.
 * Без входа: все тесты в статусе `not_started`, без баллов.
 */
export async function getTests(): Promise<
  | { success: true; data: TestListItemEnriched[] }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: tests, error: testsError } = await supabase
    .from("tests")
    .select("id, title, description")
    .order("created_at", { ascending: false });

  if (testsError) {
    return { success: false, error: testsError.message };
  }

  const list = tests ?? [];
  if (list.length === 0) {
    return { success: true, data: [] };
  }

  const testIds = list.map((t) => t.id);

  const { data: questionsRows, error: qErr } = await supabase
    .from("questions")
    .select("test_id")
    .in("test_id", testIds);

  if (qErr) {
    return { success: false, error: qErr.message };
  }

  const totalByTest = new Map<string, number>();
  for (const row of questionsRows ?? []) {
    totalByTest.set(row.test_id, (totalByTest.get(row.test_id) ?? 0) + 1);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: true,
      data: list.map((t) => ({
        ...t,
        totalQuestions: totalByTest.get(t.id) ?? 0,
        userStatus: "not_started" as const,
        bestScore: null,
        hasCompletedAttempt: false,
      })),
    };
  }

  const { data: attempts, error: attErr } = await supabase
    .from("student_attempts")
    .select("test_id, status, score")
    .eq("student_id", user.id)
    .in("test_id", testIds);

  if (attErr) {
    return { success: false, error: attErr.message };
  }

  type Agg = {
    hasInProgress: boolean;
    hasCompleted: boolean;
    bestScore: number | null;
  };

  const aggByTest = new Map<string, Agg>();

  for (const a of attempts ?? []) {
    let cur = aggByTest.get(a.test_id);
    if (!cur) {
      cur = {
        hasInProgress: false,
        hasCompleted: false,
        bestScore: null,
      };
    }
    if (a.status === "in_progress") {
      cur.hasInProgress = true;
    }
    if (a.status === "completed") {
      cur.hasCompleted = true;
      const s = a.score ?? 0;
      cur.bestScore =
        cur.bestScore === null ? s : Math.max(cur.bestScore, s);
    }
    aggByTest.set(a.test_id, cur);
  }

  const data: TestListItemEnriched[] = list.map((t) => {
    const a = aggByTest.get(t.id);
    const totalQuestions = totalByTest.get(t.id) ?? 0;

    let userStatus: TestListUserStatus;
    if (a?.hasInProgress) {
      userStatus = "in_progress";
    } else if (a?.hasCompleted) {
      userStatus = "completed";
    } else {
      userStatus = "not_started";
    }

    return {
      ...t,
      totalQuestions,
      userStatus,
      bestScore:
        a?.hasCompleted ? (a.bestScore ?? 0) : null,
      hasCompletedAttempt: a?.hasCompleted ?? false,
    };
  });

  return { success: true, data };
}

/**
 * Удаляет тест. Каскад по дочерним таблицам — в БД (`ON DELETE CASCADE`).
 * Дополнительно: только строка с `user_id` = текущий пользователь (Zero Trust в приложении).
 */
export async function deleteTest(
  testId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const genericDeleteError =
    "Не удалось удалить тест. Возможно, у вас недостаточно прав или возникла ошибка базы данных.";

  try {
    const idResult = testIdSchema.safeParse(testId);
    if (!idResult.success) {
      return {
        success: false,
        error:
          idResult.error.issues[0]?.message ?? "Некорректный ID теста",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Требуется вход в систему" };
    }

    const tid = idResult.data;

    // Удаляем только ту строку, которая принадлежит текущему пользователю.
    const {
      data: deleted,
      error: deleteError,
    } = await supabase
      .from("tests")
      .delete()
      .eq("id", tid)
      .eq("user_id", user.id)
      .select("id");

    const effectiveCount = deleted?.length ?? 0;

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (effectiveCount === 0) {
      return {
        success: false,
        error: genericDeleteError,
      };
    }

    revalidatePath("/dashboard/tests");
    revalidatePath("/test");
    revalidatePath("/");

    return { success: true };
  } catch (error: unknown) {
    console.error("deleteTest error:", error);
    return { success: false, error: genericDeleteError };
  }
}

/**
 * Загружает тест с вопросами и вариантами.
 * Для `options` запрашиваются только id, content, order_index — поле is_correct в ответ API не попадает.
 */
export async function getTestWithQuestions(
  testId: string,
): Promise<
  | { success: true; data: TestWithQuestionsPayload }
  | {
      success: false;
      error: string;
      kind?: "not_found" | "supabase" | "validation";
    }
> {
  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    const msg = idResult.error.issues[0]?.message ?? "Некорректный ID теста";
    return { success: false, error: msg, kind: "validation" };
  }

  const supabase = await createClient();
  const uuid = idResult.data;

  const { data, error } = await supabase
    .from("tests")
    .select(
      `
      id,
      title,
      description,
      created_at,
      is_published,
      questions (
        id,
        content,
        order_index,
        type,
        created_at,
        options ( id, content, order_index )
      )
    `,
    )
    .eq("id", uuid)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Тест не найден",
        kind: "not_found" as const,
      };
    }
    return {
      success: false,
      error: error.message,
      kind: "supabase" as const,
    };
  }

  const rawQuestions = data.questions ?? [];

  const questions: SafeTestQuestion[] = [...rawQuestions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => {
      const opts = (q.options ?? []) as SafeTestOption[];
      return {
        id: q.id,
        content: q.content,
        order_index: q.order_index,
        type: q.type,
        created_at: q.created_at,
        options: [...opts].sort((a, b) => a.order_index - b.order_index),
      };
    });

  const payload: TestWithQuestionsPayload = {
    id: data.id,
    title: data.title,
    description: data.description,
    created_at: data.created_at,
    is_published: data.is_published,
    questions,
  };

  return { success: true, data: payload };
}

/**
 * Безопасная версия для клиентского раннера:
 * даже если в ответе есть `is_correct`, поле удаляется перед возвратом.
 */
export async function getSafeTestForClient(
  testId: string,
): Promise<
  | { success: true; data: SafeTestForClientPayload }
  | {
      success: false;
      error: string;
      kind?: "not_found" | "supabase" | "validation";
    }
> {
  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    const msg = idResult.error.issues[0]?.message ?? "Некорректный ID теста";
    return { success: false, error: msg, kind: "validation" };
  }

  const supabase = await createClient();
  const uuid = idResult.data;

  const { data, error } = await supabase
    .from("tests")
    .select(
      `
      id,
      title,
      description,
      created_at,
      is_published,
      questions (
        id,
        content,
        order_index,
        type,
        created_at,
        options ( id, content, order_index, is_correct )
      )
    `,
    )
    .eq("id", uuid)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Тест не найден",
        kind: "not_found" as const,
      };
    }
    return {
      success: false,
      error: error.message,
      kind: "supabase" as const,
    };
  }

  const questions: SafeTestQuestion[] = [...(data.questions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      content: q.content,
      order_index: q.order_index,
      type: q.type,
      created_at: q.created_at,
      options: [...(q.options ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o) => ({
          id: o.id,
          content: o.content,
          order_index: o.order_index,
        })),
    }));

  return {
    success: true,
    data: {
      id: data.id,
      title: data.title,
      description: data.description,
      created_at: data.created_at,
      is_published: data.is_published,
      questions,
    },
  };
}

async function fetchInProgressAttemptId(
  supabase: SupabaseClient<Database>,
  studentId: string,
  testId: string,
): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const { data: rows, error } = await supabase
    .from("student_attempts")
    .select("id")
    .eq("student_id", studentId)
    .eq("test_id", testId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    return { ok: false, error: error.message };
  }

  const id = rows?.[0]?.id;
  if (id) {
    return { ok: true, id };
  }
  return { ok: false, error: "" };
}

/**
 * Get-or-create: возвращает текущую попытку `in_progress`, если есть.
 * Если последняя попытка только `completed` (или попыток не было) — создаётся новая строка
 * (пересдача). При гонке вставок или duplicate key повторно читает `in_progress`.
 */
export async function getOrCreateAttempt(
  testId: string,
): Promise<
  | { success: true; attemptId: string }
  | { success: false; error: string; needAuth?: boolean }
> {
  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    const msg = idResult.error.issues[0]?.message ?? "Некорректный ID теста";
    return { success: false, error: msg };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Войдите, чтобы проходить тест",
      needAuth: true,
    };
  }

  const existing = await fetchInProgressAttemptId(
    supabase,
    user.id,
    idResult.data,
  );
  if (!existing.ok && existing.error) {
    return { success: false, error: existing.error };
  }
  if (existing.ok) {
    return { success: true, attemptId: existing.id };
  }

  const { data: row, error: insertError } = await supabase
    .from("student_attempts")
    .insert({
      student_id: user.id,
      test_id: idResult.data,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!insertError && row) {
    return { success: true, attemptId: row.id };
  }

  const isDuplicate =
    insertError?.code === "23505" ||
    (insertError?.message?.toLowerCase().includes("duplicate") ?? false);

  if (isDuplicate) {
    const again = await fetchInProgressAttemptId(
      supabase,
      user.id,
      idResult.data,
    );
    if (again.ok) {
      return { success: true, attemptId: again.id };
    }
  }

  return {
    success: false,
    error: insertError?.message ?? "Не удалось начать попытку",
  };
}

/** @deprecated Используйте `getOrCreateAttempt` */
export const getOrCreateInProgressAttempt = getOrCreateAttempt;

/**
 * Приводит Zod-поля к тому, что сейчас принимает БД: `option_id` NOT NULL + JSONB `answer_data`.
 */
function resolveOptionAndAnswerData(
  option_id: SubmitAnswerInput["option_id"],
  answer_data: SubmitAnswerInput["answer_data"],
):
  | { ok: true; optionId: string; answerData: Json | null; allOptionIds: string[] }
  | { ok: false; error: string } {
  const extra: Json | null =
    answer_data !== undefined && answer_data !== null
      ? (answer_data as Json)
      : null;

  if (typeof option_id === "string") {
    return {
      ok: true,
      optionId: option_id,
      answerData: extra,
      allOptionIds: [option_id],
    };
  }

  if (Array.isArray(option_id) && option_id.length > 0) {
    const uniqueIds = Array.from(new Set(option_id));
    const merged: Json =
      extra !== null && typeof extra === "object" && !Array.isArray(extra)
        ? {
            ...(extra as Record<string, Json | undefined>),
            selectedOptionIds: uniqueIds,
          }
        : { selectedOptionIds: uniqueIds };
    return {
      ok: true,
      optionId: uniqueIds[0]!,
      answerData: merged,
      allOptionIds: uniqueIds,
    };
  }

  if (
    option_id &&
    typeof option_id === "object" &&
    !Array.isArray(option_id)
  ) {
    return {
      ok: false,
      error:
        "Объект в option_id пока не поддерживается: передайте UUID, массив UUID или только answer_data после миграции NULLABLE для option_id.",
    };
  }

  if (extra !== null) {
    return {
      ok: false,
      error:
        "Сохранение только answer_data невозможно: в БД attempt_answers.option_id обязателен (NOT NULL). Добавьте миграцию или передайте option_id.",
    };
  }

  return { ok: false, error: "Не указан вариант ответа" };
}

export type AttemptResult = {
  /** Сохранено в `student_attempts.score` — сумма верных «единиц» (пары image_labeling, пропуски fill_in_the_blanks, иначе до 1 на вопрос). */
  score: number;
  correctCount: number;
  /** Максимум баллов за попытку: пары у image_labeling, пропуски у fill_in_the_blanks, иначе 1 на вопрос. */
  totalQuestions: number;
  answeredCount: number;
  percentCorrect: number;
};

async function deleteAttemptAnswersForQuestion(
  supabase: SupabaseClient<Database>,
  attemptId: string,
  questionId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("attempt_answers")
    .delete()
    .match({ attempt_id: attemptId, question_id: questionId });
  return error?.message ?? null;
}

/**
 * Сохраняет ответ по вопросу в рамках попытки.
 * Пазл (клик): `answerData: { matchingPairs: [...] }`.
 * Супер-пазл (DnD): `answerData: { pairs: [...] }`. Без `option_id` в payload.
 */
export async function submitAnswer(
  attemptId: string,
  questionId: string,
  optionIdOrComplex?: string | string[] | Record<string, unknown>,
  answerData?: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  const idsCheck = z
    .object({
      attempt_id: z.string().uuid(),
      question_id: z.string().uuid(),
    })
    .safeParse({ attempt_id: attemptId, question_id: questionId });
  if (!idsCheck.success) {
    return {
      success: false,
      error: idsCheck.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  const { attempt_id, question_id } = idsCheck.data;

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
    .eq("id", attempt_id)
    .single();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.student_id !== user.id) {
    return { success: false, error: "Нет доступа к этой попытке" };
  }

  if (attempt.status !== "in_progress") {
    return { success: false, error: "Попытка уже завершена" };
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, test_id, type, content")
    .eq("id", question_id)
    .single();

  if (questionError || !question || question.test_id !== attempt.test_id) {
    return { success: false, error: "Вопрос не относится к этому тесту" };
  }

  if (question.type === "matching_puzzle" || question.type === "dnd_puzzle") {
    let pairsToValidate: {
      leftOptionId: string;
      rightOptionId: string;
    }[];

    if (question.type === "dnd_puzzle") {
      const dndParsed = dndPuzzleAnswerPayloadSchema.safeParse(answerData);
      if (!dndParsed.success) {
        return {
          success: false,
          error:
            dndParsed.error.issues[0]?.message ??
            "Некорректные пары сопоставления",
        };
      }
      pairsToValidate = dndParsed.data.pairs;
    } else {
      const mpParsed = matchingAnswerPayloadSchema.safeParse(answerData);
      if (!mpParsed.success) {
        return {
          success: false,
          error:
            mpParsed.error.issues[0]?.message ??
            "Некорректные пары сопоставления",
        };
      }
      pairsToValidate = mpParsed.data.matchingPairs;
    }

    const { data: qopts, error: qoErr } = await supabase
      .from("options")
      .select("id")
      .eq("question_id", question_id);

    if (qoErr) {
      return { success: false, error: qoErr.message };
    }

    const idSet = new Set((qopts ?? []).map((o) => o.id));
    if (!validateMatchingPairsStructure(pairsToValidate, idSet)) {
      return {
        success: false,
        error: "Нужно сопоставить каждую левую и правую часть ровно один раз",
      };
    }

    const anchorId = qopts?.[0]?.id;
    if (!anchorId) {
      return { success: false, error: "У вопроса нет пар для пазла" };
    }

    const deleteError = await deleteAttemptAnswersForQuestion(
      supabase,
      attempt_id,
      question_id,
    );
    if (deleteError) {
      return { success: false, error: deleteError };
    }

    const answerJson: Json =
      question.type === "dnd_puzzle"
        ? { pairs: pairsToValidate }
        : { matchingPairs: pairsToValidate };

    const { error: insertErr } = await supabase
      .from("attempt_answers")
      .insert({
        attempt_id,
        question_id,
        option_id: anchorId,
        answer_data: answerJson,
      });

    if (insertErr && insertErr.code !== "23505") {
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  }

  if (question.type === "image_labeling") {
    const ilParsed = imageLabelingAnswerPayloadSchema.safeParse(answerData);
    if (!ilParsed.success) {
      return {
        success: false,
        error:
          ilParsed.error.issues[0]?.message ??
          "Некорректные пары подписей к изображениям",
      };
    }

    const { data: qopts, error: qoErr } = await supabase
      .from("options")
      .select("id, content")
      .eq("question_id", question_id);

    if (qoErr) {
      return { success: false, error: qoErr.message };
    }

    const pairIds = getImageLabelingPairOptionIds(qopts ?? []);
    const legacy = partitionImageLabelingOptionIdsLegacy(qopts ?? []);
    const validPairs =
      pairIds.size > 0
        ? validateImageLabelingPairsPairedMode(
            ilParsed.data.labelPairs,
            pairIds,
          )
        : validateImageLabelingPairs(
            ilParsed.data.labelPairs,
            legacy.imageIds,
            legacy.wordIds,
          );
    if (!validPairs) {
      return {
        success: false,
        error:
          "Нужно подписать каждое изображение ровно одним словом из банка (по одному разу)",
      };
    }

    const anchorId =
      (pairIds.size > 0 ? [...pairIds][0] : [...legacy.imageIds][0]) ??
      qopts?.[0]?.id;
    if (!anchorId) {
      return { success: false, error: "У вопроса нет вариантов с картинками" };
    }

    const deleteError = await deleteAttemptAnswersForQuestion(
      supabase,
      attempt_id,
      question_id,
    );
    if (deleteError) {
      return { success: false, error: deleteError };
    }

    const answerJson: Json = { labelPairs: ilParsed.data.labelPairs };

    const { error: insertErr } = await supabase
      .from("attempt_answers")
      .insert({
        attempt_id,
        question_id,
        option_id: anchorId,
        answer_data: answerJson,
      });

    if (insertErr && insertErr.code !== "23505") {
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  }

  if (question.type === "fill_in_the_blanks") {
    const payloadParsed =
      fillInTheBlanksAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для пропусков",
      };
    }

    const contentParsed = FillInTheBlanksContentSchema.safeParse(
      question.content,
    );
    if (!contentParsed.success) {
      return { success: false, error: "Вопрос повреждён (контент пропусков)" };
    }

    const fill = contentParsed.data;
    const assign = payloadParsed.data.fillAssignments;
    const wordIds = new Set(fill.wordBank.map((w) => w.id));
    const blankIds = Object.keys(fill.correctMapping);
    if (blankIds.length === 0) {
      return { success: false, error: "В вопросе нет пропусков" };
    }
    for (const bid of blankIds) {
      const wid = assign[bid];
      if (typeof wid !== "string" || !wordIds.has(wid)) {
        return {
          success: false,
          error: "Заполните каждый пропуск словом из банка",
        };
      }
    }

    const { data: anchorOpts, error: anchorErr } = await supabase
      .from("options")
      .select("id")
      .eq("question_id", question_id)
      .order("order_index", { ascending: true })
      .limit(1);

    if (anchorErr) {
      return { success: false, error: anchorErr.message };
    }
    const anchorId = anchorOpts?.[0]?.id;
    if (!anchorId) {
      return {
        success: false,
        error: "У вопроса нет служебной записи варианта ответа",
      };
    }

    const deleteError = await deleteAttemptAnswersForQuestion(
      supabase,
      attempt_id,
      question_id,
    );
    if (deleteError) {
      return { success: false, error: deleteError };
    }

    const answerJson: Json = { fillAssignments: assign };

    const { error: insertErr } = await supabase
      .from("attempt_answers")
      .insert({
        attempt_id,
        question_id,
        option_id: anchorId,
        answer_data: answerJson,
      });

    if (insertErr && insertErr.code !== "23505") {
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  }

  const isExplicitEmptySelection =
    Array.isArray(optionIdOrComplex) && optionIdOrComplex.length === 0;
  if (isExplicitEmptySelection) {
    const deleteError = await deleteAttemptAnswersForQuestion(
      supabase,
      attempt_id,
      question_id,
    );
    if (deleteError) {
      return { success: false, error: deleteError };
    }
    return { success: true };
  }

  const parsed = submitAnswerSchema.safeParse({
    attempt_id: attemptId,
    question_id: questionId,
    option_id:
      optionIdOrComplex === "" ? undefined : optionIdOrComplex,
    answer_data: answerData,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректные данные";
    return { success: false, error: msg };
  }

  const { option_id, answer_data } = parsed.data;

  const resolved = resolveOptionAndAnswerData(option_id, answer_data);
  if (!resolved.ok) {
    return { success: false, error: resolved.error };
  }

  const { answerData: resolvedAnswerData, allOptionIds } = resolved;
  const uniqueOptionIds = Array.from(new Set(allOptionIds));

  const isMultiple =
    question.type === "multiple_choice" || question.type === "multiple";
  if (!isMultiple && uniqueOptionIds.length > 1) {
    return {
      success: false,
      error: "Для вопроса с одним ответом выберите только один вариант",
    };
  }

  const { data: optionRows, error: optionsLookupError } = await supabase
    .from("options")
    .select("id, question_id")
    .eq("question_id", question_id)
    .in("id", uniqueOptionIds);

  if (optionsLookupError) {
    return { success: false, error: optionsLookupError.message };
  }

  if (!optionRows || optionRows.length !== uniqueOptionIds.length) {
    return {
      success: false,
      error: "Один или несколько вариантов не относятся к этому вопросу",
    };
  }

  const deleteError = await deleteAttemptAnswersForQuestion(
    supabase,
    attempt_id,
    question_id,
  );
  if (deleteError) {
    return { success: false, error: deleteError };
  }

  const mergedMultiData: Json =
    resolvedAnswerData !== null &&
    typeof resolvedAnswerData === "object" &&
    !Array.isArray(resolvedAnswerData)
      ? {
          ...(resolvedAnswerData as Record<string, Json | undefined>),
          selectedOptionIds: uniqueOptionIds,
        }
      : { selectedOptionIds: uniqueOptionIds };

  const rowsToInsert = isMultiple
    ? uniqueOptionIds.map((oid) => ({
        attempt_id,
        question_id,
        option_id: oid,
        answer_data: mergedMultiData,
      }))
    : [
        {
          attempt_id,
          question_id,
          option_id: uniqueOptionIds[0]!,
          answer_data: resolvedAnswerData,
        },
      ];
  if (rowsToInsert.length === 0) {
    return { success: true };
  }

  const { error: insertErr } = await supabase
    .from("attempt_answers")
    .insert(rowsToInsert);

  if (insertErr && insertErr.code !== "23505") {
    return { success: false, error: insertErr.message };
  }

  return { success: true };
}

/**
 * Несколько строк `attempt_answers` на один вопрос (напр. multiple_choice) —
 * берём строку с полным `answer_data.selectedOptionIds`, иначе последнюю.
 */
function pickRepresentativeAttemptAnswerRow(
  questionType: string | null,
  rowsForQuestion: {
    option_id: string;
    answer_data: Json | null;
  }[],
):
  | { option_id: string; answer_data: Json | null }
  | undefined {
  if (rowsForQuestion.length === 0) {
    return undefined;
  }
  if (rowsForQuestion.length === 1) {
    return rowsForQuestion[0];
  }
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";
  if (!isMultiple) {
    return rowsForQuestion[0];
  }
  const withSel = rowsForQuestion.find((r) => {
    if (!r.answer_data || typeof r.answer_data !== "object") {
      return false;
    }
    if (Array.isArray(r.answer_data)) {
      return false;
    }
    const raw = (r.answer_data as { selectedOptionIds?: unknown })
      .selectedOptionIds;
    return Array.isArray(raw) && raw.length > 0;
  });
  return withSel ?? rowsForQuestion[rowsForQuestion.length - 1];
}

function parseSelectedIdsFromAnswerRow(
  optionId: string,
  answerData: Json | null,
  questionType: string | null,
): string[] {
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";
  if (
    isMultiple &&
    answerData &&
    typeof answerData === "object" &&
    !Array.isArray(answerData)
  ) {
    const raw = (answerData as { selectedOptionIds?: unknown })
      .selectedOptionIds;
    if (Array.isArray(raw)) {
      const ids = raw.filter((x): x is string => typeof x === "string");
      if (ids.length > 0) {
        return [...new Set(ids)];
      }
    }
  }
  return [optionId];
}

function setsOfStringsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sa = new Set(a);
  for (const x of b) {
    if (!sa.has(x)) {
      return false;
    }
  }
  return true;
}

/**
 * Ответы попытки для экрана разбора (после `completed`).
 * Клиент сам парсит `answer_data` (например `labelPairs` для image_labeling).
 */
export async function getAttemptReviewAnswers(
  attemptId: string,
): Promise<
  | {
      success: true;
      data: {
        question_id: string;
        option_id: string;
        answer_data: Json | null;
        correct_option_ids: string[];
      }[];
    }
  | { success: false; error: string }
> {
  const idResult = attemptIdSchema.safeParse(attemptId);
  if (!idResult.success) {
    return { success: false, error: "Некорректный ID попытки" };
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
    .select("id, student_id, status")
    .eq("id", idResult.data)
    .single();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.student_id !== user.id) {
    return { success: false, error: "Нет доступа к этой попытке" };
  }

  if (attempt.status !== "completed") {
    return { success: false, error: "Попытка ещё не завершена" };
  }

  const { data: rows, error: answersError } = await supabase
    .from("attempt_answers")
    .select("question_id, option_id, answer_data")
    .eq("attempt_id", idResult.data);

  if (answersError) {
    return { success: false, error: answersError.message };
  }

  const questionIds = [...new Set((rows ?? []).map((r) => r.question_id))];
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
      list.push(o.id);
      correctByQuestion.set(o.question_id, list);
    }
  }

  return {
    success: true,
    data: (rows ?? []).map((r) => ({
      question_id: r.question_id,
      option_id: r.option_id,
      answer_data: r.answer_data,
      correct_option_ids: correctByQuestion.get(r.question_id) ?? [],
    })),
  };
}

function countFillInTheBlanksSlots(content: Json | null): number {
  const p = FillInTheBlanksContentSchema.safeParse(content);
  if (!p.success) return 1;
  const k = Object.keys(p.data.correctMapping).length;
  return k > 0 ? k : 1;
}

/** Сумма «весов» вопросов: пары у `image_labeling`, пропуски у `fill_in_the_blanks`, иначе 1. */
function totalGradableUnitsForAttempt(
  questions: { id: string; type: string | null; content: Json | null }[],
  allOptions: { id: string; question_id: string; content: Json | null }[],
): number {
  let n = 0;
  for (const q of questions) {
    if (q.type === "image_labeling") {
      const qopts = allOptions.filter((o) => o.question_id === q.id);
      const pc = getImageLabelingPairOptionIds(qopts).size;
      n += pc > 0 ? pc : 1;
    } else if (q.type === "fill_in_the_blanks") {
      n += countFillInTheBlanksSlots(q.content);
    } else {
      n += 1;
    }
  }
  return n;
}

/**
 * Завершает попытку: статус `completed`, подсчёт баллов только на сервере.
 * `single_choice`: верно, если выбран один вариант с `is_correct`.
 * `multiple_choice`: верно, если множество выбранных id совпадает с множеством верных вариантов.
 */
export async function completeAttempt(
  attemptId: string,
): Promise<
  { success: true; data: AttemptResult } | { success: false; error: string }
> {
  const idResult = attemptIdSchema.safeParse(attemptId);
  if (!idResult.success) {
    const msg = idResult.error.issues[0]?.message ?? "Некорректный ID попытки";
    return { success: false, error: msg };
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
    .select("id, student_id, test_id, status, score")
    .eq("id", idResult.data)
    .single();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.student_id !== user.id) {
    return { success: false, error: "Нет доступа к этой попытке" };
  }

  const { count: totalQuestions, error: countError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", attempt.test_id);

  if (countError) {
    return { success: false, error: countError.message };
  }

  const total = totalQuestions ?? 0;

  if (attempt.status === "completed") {
    const score = attempt.score ?? 0;
    const { count: answered } = await supabase
      .from("attempt_answers")
      .select("id", { count: "exact", head: true })
      .eq("attempt_id", idResult.data);

    return {
      success: true,
      data: {
        score,
        correctCount: score,
        totalQuestions: total,
        answeredCount: answered ?? 0,
        percentCorrect:
          total > 0 ? Math.round((score / total) * 100) : 0,
      },
    };
  }

  const { data: answers, error: answersError } = await supabase
    .from("attempt_answers")
    .select("question_id, option_id, answer_data")
    .eq("attempt_id", idResult.data);

  if (answersError) {
    return { success: false, error: answersError.message };
  }

  const rows = answers ?? [];
  const answeredCount = new Set(rows.map((r) => r.question_id)).size;

  const { data: questionRows, error: questionsFetchError } = await supabase
    .from("questions")
    .select("id, type, order_index, content")
    .eq("test_id", attempt.test_id)
    .order("order_index", { ascending: true });

  if (questionsFetchError) {
    return { success: false, error: questionsFetchError.message };
  }

  const questionsOrdered = questionRows ?? [];
  const questionIds = questionsOrdered.map((q) => q.id);

  let allOptions: {
    id: string;
    question_id: string;
    is_correct: boolean | null;
    content: Json | null;
  }[] = [];

  if (questionIds.length > 0) {
    const { data: opts, error: allOptionsError } = await supabase
      .from("options")
      .select("id, question_id, is_correct, content")
      .in("question_id", questionIds);

    if (allOptionsError) {
      return { success: false, error: allOptionsError.message };
    }
    allOptions = opts ?? [];
  }

  const totalGradable = Math.max(
    totalGradableUnitsForAttempt(questionsOrdered, allOptions),
    1,
  );

  if (rows.length === 0) {
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("student_attempts")
      .update({
        status: "completed",
        score: 0,
        completed_at: completedAt,
      })
      .eq("id", idResult.data);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      data: {
        score: 0,
        correctCount: 0,
        totalQuestions: totalGradable,
        answeredCount: 0,
        percentCorrect: 0,
      },
    };
  }

  const correctIdsByQuestion = new Map<string, string[]>();
  for (const qid of questionIds) {
    correctIdsByQuestion.set(qid, []);
  }
  for (const opt of allOptions ?? []) {
    if (opt.is_correct) {
      const list = correctIdsByQuestion.get(opt.question_id) ?? [];
      if (!list.includes(opt.id)) {
        list.push(opt.id);
      }
      correctIdsByQuestion.set(opt.question_id, list);
    }
  }

  const rowsByQuestionId = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = rowsByQuestionId.get(row.question_id) ?? [];
    list.push(row);
    rowsByQuestionId.set(row.question_id, list);
  }

  let correctCount = 0;
  for (const q of questionsOrdered) {
    const listForQ = rowsByQuestionId.get(q.id);
    const answerRow = listForQ
      ? pickRepresentativeAttemptAnswerRow(q.type, listForQ)
      : undefined;
    if (!answerRow) {
      continue;
    }

    if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
      const pairs = parsePairAssignmentsFromAnswerData(answerRow.answer_data);
      const optionIdsForQ = (allOptions ?? [])
        .filter((o) => o.question_id === q.id)
        .map((o) => o.id);
      const setQ = new Set(optionIdsForQ);
      if (
        pairs &&
        validateMatchingPairsStructure(pairs, setQ) &&
        pairs.every((p) => p.leftOptionId === p.rightOptionId)
      ) {
        correctCount += 1;
      }
      continue;
    }

    if (q.type === "image_labeling") {
      const qopts = allOptions.filter((o) => o.question_id === q.id);
      const pairIds = getImageLabelingPairOptionIds(qopts);
      if (pairIds.size === 0) {
        continue;
      }
      const lp = parseLabelPairsFromAnswerData(answerRow.answer_data);
      if (!lp || lp.length !== pairIds.size) {
        continue;
      }
      const byImage = new Map(lp.map((p) => [p.imageId, p.wordId]));
      for (const pid of pairIds) {
        if (byImage.get(pid) === pid) {
          correctCount += 1;
        }
      }
      continue;
    }

    if (q.type === "fill_in_the_blanks") {
      const contentParsed = FillInTheBlanksContentSchema.safeParse(q.content);
      if (!contentParsed.success) {
        continue;
      }
      const fill = contentParsed.data;
      const blankIds = Object.keys(fill.correctMapping);
      if (blankIds.length === 0) {
        continue;
      }
      const assign = parseFillAssignmentsFromAnswerData(answerRow.answer_data);
      if (!assign) {
        continue;
      }
      for (const bid of blankIds) {
        if (assign[bid] === fill.correctMapping[bid]) {
          correctCount += 1;
        }
      }
      continue;
    }

    const studentIds = parseSelectedIdsFromAnswerRow(
      answerRow.option_id,
      answerRow.answer_data,
      q.type,
    );
    const correctIds = correctIdsByQuestion.get(q.id) ?? [];

    const isMultiple =
      q.type === "multiple_choice" || q.type === "multiple";

    if (isMultiple) {
      const a = [...new Set(studentIds)].sort();
      const b = [...new Set(correctIds)].sort();
      if (setsOfStringsEqual(a, b)) {
        correctCount += 1;
      }
    } else if (studentIds.length === 1) {
      const only = studentIds[0];
      if (correctIds.includes(only)) {
        correctCount += 1;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("student_attempts")
    .update({
      status: "completed",
      score: correctCount,
      completed_at: completedAt,
    })
    .eq("id", idResult.data);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const percentCorrect =
    totalGradable > 0
      ? Math.round((correctCount / totalGradable) * 100)
      : 0;

  return {
    success: true,
    data: {
      score: correctCount,
      correctCount,
      totalQuestions: totalGradable,
      answeredCount,
      percentCorrect,
    },
  };
}

/** Откат после частичной вставки: одно удаление теста — каскад в БД. */
async function rollbackCreatedTest(
  client: SupabaseClient<Database>,
  testId: string,
  ownerUserId: string,
): Promise<void> {
  await client
    .from("tests")
    .delete()
    .eq("id", testId)
    .eq("user_id", ownerUserId);
}

function fillContentToFormFields(content: FillInTheBlanksContent): {
  fillRawText: string;
  fillExtraWords: string[];
} {
  const wordById = new Map(content.wordBank.map((w) => [w.id, w.text]));
  const usedCorrectWordIds = new Set(Object.values(content.correctMapping));
  const extraWords = content.wordBank
    .filter((w) => !usedCorrectWordIds.has(w.id))
    .map((w) => w.text);
  let raw = "";
  for (const seg of content.segments) {
    if (seg.type === "text") {
      raw += seg.value;
    } else {
      const wid = content.correctMapping[seg.id];
      const txt = wid ? wordById.get(wid) : undefined;
      raw += txt ? `[${txt}]` : "[?]";
    }
  }
  return { fillRawText: raw, fillExtraWords: extraWords };
}

function mapDbQuestionRowToQuestionField(row: {
  content: Json;
  type: string | null;
  options?: {
    content: Json;
    order_index: number;
    is_correct: boolean | null;
  }[];
}): QuestionField {
  const rawType = row.type ?? "single_choice";
  const type =
    rawType === "multiple" ? ("multiple_choice" as const) : rawType;

  const opts = [...(row.options ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  if (type === "fill_in_the_blanks") {
    const parsed = FillInTheBlanksContentSchema.safeParse(row.content);
    if (!parsed.success) {
      return {
        text: "",
        type: "fill_in_the_blanks",
        fillRawText: "",
        fillExtraWords: [],
        fillContent: null,
      };
    }
    const { fillRawText, fillExtraWords } = fillContentToFormFields(
      parsed.data,
    );
    const textRoot = z.object({ text: z.string() }).safeParse(row.content);
    return {
      text: textRoot.success ? textRoot.data.text : "",
      type: "fill_in_the_blanks",
      fillRawText,
      fillExtraWords,
      fillContent: parsed.data,
    };
  }

  const textRoot = z.object({ text: z.string() }).safeParse(row.content);
  const text = textRoot.success ? textRoot.data.text : "";

  if (type === "matching_puzzle" || type === "dnd_puzzle") {
    const puzzleType: "matching_puzzle" | "dnd_puzzle" =
      type === "dnd_puzzle" ? "dnd_puzzle" : "matching_puzzle";
    return {
      text,
      type: puzzleType,
      options: opts.map((o) => {
        const c = o.content as { left?: unknown; right?: unknown };
        return {
          left: typeof c.left === "string" ? c.left : "",
          right: typeof c.right === "string" ? c.right : "",
        };
      }),
    };
  }

  if (type === "image_labeling") {
    return {
      text,
      type: "image_labeling",
      labelingPairs: opts.map((o) => {
        const c = o.content as {
          imageUrl?: unknown;
          correctText?: unknown;
          title?: unknown;
        };
        return {
          url: typeof c.imageUrl === "string" ? c.imageUrl : "",
          correctWord:
            typeof c.correctText === "string" ? c.correctText : "",
          title: typeof c.title === "string" ? c.title : "",
        };
      }),
    };
  }

  const qType: "single_choice" | "multiple_choice" =
    type === "multiple_choice" ? "multiple_choice" : "single_choice";

  return {
    text,
    type: qType,
    options: opts
      .filter((o) => {
        const c = o.content as { text?: unknown };
        return c.text !== "__fill_in_the_blanks__";
      })
      .map((o) => {
        const c = o.content as { text?: unknown };
        return {
          text: typeof c.text === "string" ? c.text : "",
          isCorrect: Boolean(o.is_correct),
        };
      }),
  };
}

/** Вставка вопросов и вариантов для существующего `test_id` (без отката теста). */
async function insertQuestionsAndOptionsForTest(
  client: SupabaseClient<Database>,
  testId: string,
  questions: SaveFullTestPayload["questions"],
): Promise<{ success: true } | { success: false; error: string }> {
  const questionInserts = questions.map((q, i) => ({
    test_id: testId,
    content:
      q.type === "fill_in_the_blanks"
        ? (q.content as Json)
        : ({ text: q.content.text } as Json),
    order_index: i,
    type: q.type,
  }));

  const { data: insertedQuestions, error: qInsErr } = await client
    .from("questions")
    .insert(questionInserts)
    .select("id, order_index");

  if (qInsErr || !insertedQuestions?.length) {
    return {
      success: false,
      error: qInsErr?.message ?? "Не удалось создать вопросы",
    };
  }

  const sortedQ = [...insertedQuestions].sort(
    (a, b) => a.order_index - b.order_index,
  );

  if (sortedQ.length !== questions.length) {
    return {
      success: false,
      error: "Ошибка согласованности при создании вопросов",
    };
  }

  const optionRows = sortedQ.flatMap((qRow, qi) => {
    const q = questions[qi];
    if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
      return q.options.map((opt, oi) => ({
        question_id: qRow.id,
        content: { left: opt.content.left, right: opt.content.right } as Json,
        order_index: oi,
        is_correct: true,
      }));
    }
    if (q.type === "image_labeling") {
      return q.options.map((opt, oi) => {
        const c = opt.content;
        const content: Json = {
          imageUrl: c.imageUrl,
          correctText: c.correctText,
          ...(c.title != null && String(c.title).trim() !== ""
            ? { title: String(c.title).trim() }
            : {}),
        };
        return {
          question_id: qRow.id,
          content,
          order_index: oi,
          is_correct: true,
        };
      });
    }
    if (q.type === "fill_in_the_blanks") {
      return [
        {
          question_id: qRow.id,
          content: { text: "__fill_in_the_blanks__" } as Json,
          order_index: 0,
          is_correct: true,
        },
      ];
    }
    return q.options.map((opt, oi) => ({
      question_id: qRow.id,
      content: { text: opt.content.text } as Json,
      order_index: oi,
      is_correct: opt.is_correct,
    }));
  });

  if (optionRows.length > 0) {
    const { error: oInsErr } = await client.from("options").insert(optionRows);

    if (oInsErr) {
      return { success: false, error: oInsErr.message };
    }
  }

  return { success: true };
}

const attemptsBlockEditMessage =
  "Нельзя редактировать вопросы в тесте, который уже начали проходить студенты.";

/**
 * Данные теста для формы создания/редактирования (с `is_correct` у вариантов).
 * Доступ: роль teacher или admin; teacher — только свой `tests.user_id`.
 */
export async function getTestDraftForEdit(
  testId: string,
): Promise<
  | { success: true; data: { id: string; initialData: CreateTestFormInitialData } }
  | { success: false; error: string }
> {
  const forbiddenMessage =
    "Доступ запрещён. Редактировать тест могут только преподаватели или администраторы.";

  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    return {
      success: false,
      error:
        idResult.error.issues[0]?.message ?? "Некорректный ID теста",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется войти в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: forbiddenMessage };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return { success: false, error: forbiddenMessage };
  }

  const tid = idResult.data;

  const { data, error } = await supabase
    .from("tests")
    .select(
      `
      id,
      title,
      description,
      user_id,
      questions (
        content,
        order_index,
        type,
        options ( content, order_index, is_correct )
      )
    `,
    )
    .eq("id", tid)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Тест не найден" };
    }
    return { success: false, error: error.message };
  }

  if (profile.role !== "admin" && data.user_id !== user.id) {
    return {
      success: false,
      error: "Вы можете редактировать только свои тесты.",
    };
  }

  const rawQuestions = data.questions ?? [];
  const sorted = [...rawQuestions].sort((a, b) => a.order_index - b.order_index);
  const questions = sorted.map((q) => mapDbQuestionRowToQuestionField(q));

  const initialData: CreateTestFormInitialData = {
    title: data.title,
    description: data.description ?? "",
    questions,
  };

  return {
    success: true,
    data: { id: data.id, initialData },
  };
}

export async function updateFullTest(
  testId: string,
  payload: unknown,
): Promise<
  { success: true; testId: string } | { success: false; error: string }
> {
  const forbiddenMessage =
    "Доступ запрещен. Тесты могут сохранять только преподаватели или администраторы.";

  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    return {
      success: false,
      error:
        idResult.error.issues[0]?.message ?? "Некорректный ID теста",
    };
  }

  const parsed = saveFullTestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Некорректные данные для сохранения";
    return { success: false, error: msg };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Требуется войти в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: forbiddenMessage };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return { success: false, error: forbiddenMessage };
  }

  const tid = idResult.data;

  const { data: testRow, error: testFetchErr } = await supabase
    .from("tests")
    .select("id, user_id")
    .eq("id", tid)
    .single();

  if (testFetchErr || !testRow) {
    return {
      success: false,
      error:
        testFetchErr?.code === "PGRST116"
          ? "Тест не найден"
          : (testFetchErr?.message ?? "Тест не найден"),
    };
  }

  if (profile.role !== "admin" && testRow.user_id !== user.id) {
    return {
      success: false,
      error: "Вы можете редактировать только свои тесты.",
    };
  }

  const { count: attemptCount, error: countErr } = await supabase
    .from("student_attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", tid);

  if (countErr) {
    return { success: false, error: countErr.message };
  }

  if ((attemptCount ?? 0) > 0) {
    return { success: false, error: attemptsBlockEditMessage };
  }

  const d = parsed.data;

  const { error: updateTestErr } = await supabase
    .from("tests")
    .update({
      title: d.title,
      description: d.description ?? null,
      is_published: d.is_published ?? true,
    })
    .eq("id", tid);

  if (updateTestErr) {
    return { success: false, error: updateTestErr.message };
  }

  try {
    const { error: delErr } = await supabase
      .from("questions")
      .delete()
      .eq("test_id", tid);

    if (delErr) {
      const code = delErr.code?.toUpperCase?.() ?? "";
      const msg = delErr.message?.toLowerCase?.() ?? "";
      if (
        code === "23503" ||
        msg.includes("foreign key") ||
        msg.includes("violates foreign key")
      ) {
        return { success: false, error: attemptsBlockEditMessage };
      }
      return { success: false, error: delErr.message };
    }

    const ins = await insertQuestionsAndOptionsForTest(supabase, tid, d.questions);
    if (!ins.success) {
      return { success: false, error: ins.error };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const low = message.toLowerCase();
    if (low.includes("foreign key") || low.includes("violates")) {
      return { success: false, error: attemptsBlockEditMessage };
    }
    return { success: false, error: message };
  }

  revalidatePath("/dashboard/tests");
  revalidatePath(`/test/${tid}`);
  return { success: true, testId: tid };
}

/**
 * Создаёт тест, вопросы и варианты за несколько запросов.
 * При любой ошибке после создания теста вызывается откат (имитация транзакции).
 */
export async function saveFullTest(
  payload: unknown,
): Promise<
  { success: true; testId: string } | { success: false; error: string }
> {
  const forbiddenMessage =
    "Доступ запрещен. Тесты могут создавать только преподаватели или администраторы.";

  const parsed = saveFullTestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Некорректные данные для сохранения";
    return { success: false, error: msg };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Требуется войти в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: forbiddenMessage };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return { success: false, error: forbiddenMessage };
  }

  const d = parsed.data;

  const { data: testRow, error: testErr } = await supabase
    .from("tests")
    .insert({
      title: d.title,
      description: d.description ?? null,
      is_published: d.is_published ?? true,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (testErr || !testRow) {
    return {
      success: false,
      error: testErr?.message ?? "Не удалось создать тест",
    };
  }

  const testId = testRow.id;

  const inserted = await insertQuestionsAndOptionsForTest(
    supabase,
    testId,
    d.questions,
  );
  if (!inserted.success) {
    await rollbackCreatedTest(supabase, testId, user.id);
    return { success: false, error: inserted.error };
  }

  revalidatePath("/dashboard/tests");
  revalidatePath(`/test/${testId}`);

  return { success: true, testId };
}
