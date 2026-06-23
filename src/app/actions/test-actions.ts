"use server";

import { revalidatePath } from "next/cache";
import {
  GROUPED_FILL_BLANKS_ANCHOR_TEXT,
  extractExtraWordsFromFillContent,
  isGroupedFillAssignmentsComplete,
  isGroupedFillBlanksFullyCorrect,
  isGroupedFillBlanksSelectionComplete,
  isGroupedFillInTheBlanksFullyCorrect,
  LEGACY_GROUPED_FILL_ITEM_ID,
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillBlanksItems,
  parseGroupedFillTypingFromAnswerData,
  resolveGroupedFillBlanksMode,
  resolveGroupedFillBlanksPlayerView,
  scoreGroupedFillInTheBlanksQuestion,
  scoreGroupedFillBlanksTypingQuestion,
  sumGroupedFillBlanksPoints,
  newGroupedFillBlanksId,
  normalizeGroupedFillBlanksItemText,
  parseGroupedFillBlanksItemText,
} from "@/lib/grouped-fill-blanks-utils";
import {
  GROUPED_CHOICE_ANCHOR_TEXT,
  groupedCorrectMapFromContent,
  isGroupedChoiceContent,
  LEGACY_GROUPED_ITEM_ID,
  parseGroupedChoiceItems,
  parseGroupedSelectionsFromAnswerData,
  scoreGroupedChoiceQuestion,
  sumGroupedItemPoints,
  sanitizeGroupedChoiceContentForClient,
} from "@/lib/grouped-choice-utils";
import {
  GROUPED_ORDERING_ANCHOR_TEXT,
  groupedCorrectOrderingMapFromContent,
  isOrderingAssignmentsComplete,
  newOrderingId,
  parseOrderingItems,
  resolveOrderingPlayerView,
  sumOrderingItemPoints,
} from "@/lib/ordering-utils";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentFacingTestTitle } from "@/lib/learn/student-test-title";
import {
  saveFullTestPayloadSchema,
  type SaveFullTestPayload,
} from "@/lib/validations/admin-test-schema";
import {
  groupedChoiceContentSchema,
} from "@/lib/validations/grouped-choice-schema";
import {
  groupedFillBlanksContentSchema,
  groupedFillInTheBlanksContentSchema,
  groupedTextInputContentSchema,
} from "@/lib/validations/grouped-fill-blanks-schema";
import { orderingContentSchema } from "@/lib/validations/ordering-schema";
import {
  parseFillAssignmentsFromAnswerData,
  parseFillTypingFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import {
  FillInTheBlanksContentSchema,
  TextInputContentSchema,
  blankIdsFromSegments,
  type FillInTheBlanksContent,
} from "@/lib/validations/fill-in-the-blanks-schema";
import {
  submitAnswerSchema,
  type SubmitAnswerInput,
} from "@/lib/validations/test-schemas";
import {
  clampScorePercent,
  resolveQuestionPoints,
  sumQuestionPoints,
} from "@/lib/utils/grading";
import {
  getAttemptQuestionEarnedPoints,
  getImageLabelingPairOptionIds,
  parsePairAssignmentsFromAnswerData,
  pickRepresentativeAttemptAnswerRow,
  resolveQuestionMaxPoints,
  validateMatchingPairsStructure,
} from "@/lib/utils/scoring-utils";
import { mergeLegacyAudioUrlIntoHtml } from "@/lib/utils/task-content";
import type {
  CreateTestFormInitialData,
  QuestionField,
} from "@/types/create-test-form";
import type { Database, Json, Tables } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

const testIdSchema = z.string().uuid("Некорректный ID теста");

type TestAccessContext = {
  userId: string | null;
  role: ProfileRole | null;
};

type TestQuestionsFetchFailure = {
  success: false;
  error: string;
  kind?: "not_found" | "supabase" | "validation";
};

type RawTestOptionRow = {
  id: string;
  content: Json;
  order_index: number;
  is_correct?: boolean | null;
};

type RawTestQuestionRow = {
  id: string;
  content: Json;
  order_index: number;
  type: string | null;
  created_at: string | null;
  media_play_limit: number | null;
  points: number | null;
  options: RawTestOptionRow[] | null;
};

type RawTestWithQuestionsRow = {
  id: string;
  title: string;
  title_student: string | null;
  title_teacher: string | null;
  description: string | null;
  folder_name: string | null;
  created_at: string | null;
  is_published: boolean | null;
  is_for_kids: boolean;
  time_limit: number;
  test_type: string;
  user_id: string | null;
  questions: RawTestQuestionRow[] | null;
};

const TEST_WITH_QUESTIONS_SELECT = `
  id,
  title,
  title_student,
  title_teacher,
  description,
  folder_name,
  created_at,
  is_published,
  is_for_kids,
  time_limit,
  test_type,
  user_id,
  questions (
    id,
    content,
    order_index,
    type,
    created_at,
    media_play_limit,
    points,
    options ( id, content, order_index, is_correct )
  )
`;

async function resolveTestAccessContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<TestAccessContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, role: profile?.role ?? null };
}

function canViewUnpublishedTest(
  access: TestAccessContext,
  testUserId: string | null,
): boolean {
  if (!access.userId) {
    return false;
  }
  if (access.role === "admin") {
    return true;
  }
  return testUserId !== null && testUserId === access.userId;
}

function canViewCorrectAnswers(
  access: TestAccessContext,
  testUserId: string | null,
): boolean {
  if (!access.userId) {
    return false;
  }
  if (access.role === "admin") {
    return true;
  }
  return access.role === "teacher" && testUserId === access.userId;
}

function assertPublishedTestReadable(
  access: TestAccessContext,
  test: Pick<RawTestWithQuestionsRow, "is_published" | "user_id">,
): TestQuestionsFetchFailure | null {
  const isPublished = test.is_published === true;

  if (!access.userId) {
    if (!isPublished) {
      return {
        success: false,
        error: "Тест не найден",
        kind: "not_found",
      };
    }
    return null;
  }

  if (!isPublished && !canViewUnpublishedTest(access, test.user_id)) {
    return {
      success: false,
      error: "Тест не найден",
      kind: "not_found",
    };
  }

  return null;
}

function mapQuestionContentForClient(
  content: Json,
  revealCorrectAnswers: boolean,
): Json {
  if (revealCorrectAnswers || !isGroupedChoiceContent(content)) {
    return content;
  }
  return sanitizeGroupedChoiceContentForClient(content);
}

function mapQuestionsForClient(
  rawQuestions: RawTestQuestionRow[] | null,
  revealCorrectAnswers: boolean,
): SafeTestQuestion[] {
  return [...(rawQuestions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      content: mapQuestionContentForClient(q.content, revealCorrectAnswers),
      order_index: q.order_index,
      type: q.type,
      created_at: q.created_at,
      media_play_limit: q.media_play_limit ?? 0,
      points: q.points ?? 0,
      options: [...(q.options ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((option) => ({
          id: option.id,
          content: option.content,
          order_index: option.order_index,
        })),
    }));
}

function buildTestWithQuestionsPayload(
  data: RawTestWithQuestionsRow,
  revealCorrectAnswers: boolean,
): TestWithQuestionsPayload {
  return {
    id: data.id,
    title: resolveStudentFacingTestTitle(data),
    description: data.description,
    folder_name: data.folder_name,
    created_at: data.created_at,
    is_published: data.is_published,
    is_for_kids: data.is_for_kids ?? false,
    time_limit: data.time_limit ?? 0,
    test_type: data.test_type ?? "final",
    questions: mapQuestionsForClient(data.questions, revealCorrectAnswers),
  };
}

async function fetchTestWithQuestionsSecure(
  testId: string,
): Promise<
  | {
      success: true;
      data: RawTestWithQuestionsRow;
      access: TestAccessContext;
    }
  | TestQuestionsFetchFailure
> {
  const idResult = testIdSchema.safeParse(testId);
  if (!idResult.success) {
    const msg = idResult.error.issues[0]?.message ?? "Некорректный ID теста";
    return { success: false, error: msg, kind: "validation" };
  }

  const supabase = await createClient();
  const access = await resolveTestAccessContext(supabase);

  const { data, error } = await supabase
    .from("tests")
    .select(TEST_WITH_QUESTIONS_SELECT)
    .eq("id", idResult.data)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Тест не найден",
        kind: "not_found",
      };
    }
    return {
      success: false,
      error: error.message,
      kind: "supabase",
    };
  }

  const accessError = assertPublishedTestReadable(access, data);
  if (accessError) {
    return accessError;
  }

  return { success: true, data, access };
}

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

const fillBlanksTypingAnswerPayloadSchema = z.object({
  fillTyping: z.record(z.string(), z.string()),
});

const groupedFillTypingAnswerPayloadSchema = z.union([
  z.object({
    groupedFillTyping: z.record(
      z.string(),
      z.record(z.string(), z.string()),
    ),
  }),
  fillBlanksTypingAnswerPayloadSchema,
]);

function normalizeGroupedFillTypingPayload(
  answerData: unknown,
): Record<string, Record<string, string>> | null {
  const groupedParsed = z
    .object({
      groupedFillTyping: z.record(
        z.string(),
        z.record(z.string(), z.string()),
      ),
    })
    .safeParse(answerData);
  if (groupedParsed.success) {
    return groupedParsed.data.groupedFillTyping;
  }
  const legacyParsed = fillBlanksTypingAnswerPayloadSchema.safeParse(answerData);
  if (legacyParsed.success) {
    return { [LEGACY_GROUPED_FILL_ITEM_ID]: legacyParsed.data.fillTyping };
  }
  return null;
}

function validateGroupedFillTypingSubmission(params: {
  content: Json;
  questionType: string | null;
  groupedTyping: Record<string, Record<string, string>>;
}): { ok: true } | { ok: false; error: string } {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content,
    questionType: params.questionType,
  });
  if (!view) {
    return { ok: false, error: "Вопрос повреждён (контент пропусков)" };
  }
  if (!isGroupedFillBlanksSelectionComplete(view, params.groupedTyping)) {
    const message =
      params.questionType === "text_input"
        ? "Заполните каждое поле развёрнутого ответа"
        : "Заполните каждый пропуск";
    return { ok: false, error: message };
  }
  return { ok: true };
}

const groupedFillAssignmentsAnswerPayloadSchema = z.union([
  z.object({
    groupedFillAssignments: z.record(
      z.string(),
      z.record(z.string(), z.string()),
    ),
  }),
  fillInTheBlanksAnswerPayloadSchema,
]);

function normalizeGroupedFillAssignmentsPayload(
  answerData: unknown,
): Record<string, Record<string, string>> | null {
  const groupedParsed = z
    .object({
      groupedFillAssignments: z.record(
        z.string(),
        z.record(z.string(), z.string()),
      ),
    })
    .safeParse(answerData);
  if (groupedParsed.success) {
    return groupedParsed.data.groupedFillAssignments;
  }
  const legacyParsed = fillInTheBlanksAnswerPayloadSchema.safeParse(answerData);
  if (legacyParsed.success) {
    return { [LEGACY_GROUPED_FILL_ITEM_ID]: legacyParsed.data.fillAssignments };
  }
  return null;
}

function validateGroupedFillAssignmentsSubmission(params: {
  content: Json;
  questionType: string | null;
  groupedAssignments: Record<string, Record<string, string>>;
}): { ok: true } | { ok: false; error: string } {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content,
    questionType: params.questionType,
  });
  if (!view) {
    return { ok: false, error: "Вопрос повреждён (контент пропусков)" };
  }
  if (!isGroupedFillAssignmentsComplete(view, params.groupedAssignments)) {
    return {
      ok: false,
      error: "Заполните каждый пропуск словом из банка",
    };
  }
  return { ok: true };
}

const groupedOrderingAnswerPayloadSchema = z.object({
  orderingAssignments: z.record(z.string(), z.array(z.string().min(1))),
});

const groupedChoiceAnswerPayloadSchema = z.object({
  groupedSelections: z.record(z.string(), z.array(z.string().min(1))),
});

function isFillGapQuestionType(type: string | null | undefined): boolean {
  return (
    type === "fill_in_the_blanks" ||
    type === "fill_in_the_blanks_multi" ||
    type === "fill_blanks_typing" ||
    type === "fill_blanks_typing_multi" ||
    type === "text_input"
  );
}

function isOrderingQuestionType(type: string | null | undefined): boolean {
  return type === "ordering";
}

function isChoiceQuestionType(type: string | null | undefined): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "multiple"
  );
}

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

const attemptIdSchema = z.string().uuid("Некорректный ID попытки");

/** Вариант ответа без `is_correct` — такой набор уходит на клиент. */
export type SafeTestOption = Pick<
  Tables<"options">,
  "id" | "content" | "order_index"
>;

export type SafeTestQuestion = Pick<
  Tables<"questions">,
  "id" | "content" | "order_index" | "type" | "created_at" | "media_play_limit" | "points"
> & {
  options: SafeTestOption[];
};

export type TestWithQuestionsPayload = Pick<
  Tables<"tests">,
  | "id"
  | "title"
  | "description"
  | "folder_name"
  | "created_at"
  | "is_published"
  | "is_for_kids"
  | "time_limit"
  | "test_type"
> & {
  questions: SafeTestQuestion[];
};

export type SafeTestForClientPayload = TestWithQuestionsPayload;

export type TestListItem = Pick<
  Tables<"tests">,
  "id" | "title" | "description" | "folder_name"
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

export async function getUniqueTestFolders(): Promise<
  { success: true; data: string[] } | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data, error } = await supabase
    .from("tests")
    .select("folder_name")
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  const uniqueFolders = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.folder_name?.trim() ?? "")
        .filter((name) => name.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));

  return { success: true, data: uniqueFolders };
}

/**
 * Список тестов и сводка по `student_attempts` для текущего пользователя.
 * Гость / student: только опубликованные. Teacher: свои + опубликованные. Admin: все.
 */
export async function getTests(): Promise<
  | { success: true; data: TestListItemEnriched[] }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: ProfileRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? null;
  }

  let testsQuery = supabase
    .from("tests")
    .select("id, title, description, folder_name")
    .order("created_at", { ascending: false });

  if (!user || role === "student") {
    testsQuery = testsQuery.eq("is_published", true);
  } else if (role === "teacher") {
    testsQuery = testsQuery.or(
      `is_published.eq.true,user_id.eq.${user.id}`,
    );
  }

  const { data: tests, error: testsError } = await testsQuery;

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

export async function duplicateTest(
  testId: string,
): Promise<{ success: true; testId: string } | { success: false; error: string }> {
  const forbiddenMessage =
    "Доступ запрещен. Тесты могут дублировать только преподаватели или администраторы.";

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
  const { data: sourceTest, error: sourceError } = await supabase
    .from("tests")
    .select(
      `
      id,
      title,
      title_student,
      title_teacher,
      description,
      folder_name,
      user_id,
      questions (
        id,
        content,
        order_index,
        type,
        options ( id, content, order_index, is_correct )
      )
    `,
    )
    .eq("id", tid)
    .single();

  if (sourceError || !sourceTest) {
    return {
      success: false,
      error:
        sourceError?.code === "PGRST116"
          ? "Тест не найден"
          : (sourceError?.message ?? "Тест не найден"),
    };
  }

  if (profile.role !== "admin" && sourceTest.user_id !== user.id) {
    return {
      success: false,
      error: "Вы можете копировать только свои тесты.",
    };
  }

  const cloneTitle = `${sourceTest.title} - копия`;
  const { data: insertedTest, error: insertTestError } = await supabase
    .from("tests")
    .insert({
      title: cloneTitle,
      description: sourceTest.description ?? null,
      folder_name: sourceTest.folder_name?.trim() ? sourceTest.folder_name.trim() : null,
      is_published: false,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (insertTestError || !insertedTest) {
    return {
      success: false,
      error: insertTestError?.message ?? "Не удалось создать копию теста",
    };
  }

  const clonedTestId = insertedTest.id;
  const sourceQuestions = [...(sourceTest.questions ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  if (sourceQuestions.length > 0) {
    const questionInsertRows: Database["public"]["Tables"]["questions"]["Insert"][] =
      sourceQuestions.map((question) => ({
        test_id: clonedTestId,
        content: question.content,
        order_index: question.order_index,
        type: question.type,
      }));

    const { data: insertedQuestions, error: insertQuestionsError } = await supabase
      .from("questions")
      .insert(questionInsertRows)
      .select("id, order_index");

    if (insertQuestionsError || !insertedQuestions) {
      await rollbackCreatedTest(supabase, clonedTestId, user.id);
      return {
        success: false,
        error: insertQuestionsError?.message ?? "Не удалось скопировать вопросы",
      };
    }

    const sourceSortedByOrder = [...sourceQuestions].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const insertedSortedByOrder = [...insertedQuestions].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const oldToNewQuestionId = new Map<string, string>();
    for (let i = 0; i < sourceSortedByOrder.length; i += 1) {
      const oldId = sourceSortedByOrder[i]?.id;
      const newId = insertedSortedByOrder[i]?.id;
      if (oldId && newId) {
        oldToNewQuestionId.set(oldId, newId);
      }
    }

    const optionRows: Database["public"]["Tables"]["options"]["Insert"][] = sourceQuestions.flatMap(
      (sourceQuestion) => {
      const newQuestionId = oldToNewQuestionId.get(sourceQuestion.id);
      if (!newQuestionId) return [];
      return [...(sourceQuestion.options ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((option) => ({
          question_id: newQuestionId,
          content: option.content,
          order_index: option.order_index,
          is_correct: Boolean(option.is_correct),
        }));
    });

    if (optionRows.length > 0) {
      const { error: insertOptionsError } = await supabase
        .from("options")
        .insert(optionRows);

      if (insertOptionsError) {
        await rollbackCreatedTest(supabase, clonedTestId, user.id);
        return {
          success: false,
          error: insertOptionsError.message || "Не удалось скопировать варианты ответов",
        };
      }
    }
  }

  revalidatePath("/dashboard/tests");
  return { success: true, testId: clonedTestId };
}

/**
 * Загружает тест с вопросами и вариантами.
 * Опубликованные тесты доступны без входа; черновики — только владельцу или admin.
 * `is_correct` и ответы в grouped-choice не отдаются студентам и гостям.
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
  const result = await fetchTestWithQuestionsSecure(testId);
  if (!result.success) {
    return result;
  }

  const revealCorrectAnswers = canViewCorrectAnswers(
    result.access,
    result.data.user_id,
  );

  return {
    success: true,
    data: buildTestWithQuestionsPayload(result.data, revealCorrectAnswers),
  };
}

/**
 * Безопасная версия для клиентского раннера:
 * те же правила доступа, но `is_correct` и ответы в контенте никогда не возвращаются.
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
  const result = await fetchTestWithQuestionsSecure(testId);
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: buildTestWithQuestionsPayload(result.data, false),
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

/**
 * Песочница преподавателя: удаляет все предыдущие попытки текущего пользователя
 * по этому тесту (каскадом уходят `attempt_answers`) и создаёт новую тренировочную.
 */
export async function resetAndCreatePreviewAttempt(
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

  const forbiddenMessage =
    "Доступ запрещён. Песочницу могут открывать только преподаватели или администраторы.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Войдите, чтобы открыть песочницу",
      needAuth: true,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: forbiddenMessage };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return { success: false, error: forbiddenMessage };
  }

  const tid = idResult.data;

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, user_id")
    .eq("id", tid)
    .maybeSingle();

  if (testError) {
    return { success: false, error: testError.message };
  }

  if (!testRow) {
    return { success: false, error: "Тест не найден" };
  }

  if (profile.role !== "admin" && testRow.user_id !== user.id) {
    return { success: false, error: forbiddenMessage };
  }

  const { error: deleteError } = await supabase
    .from("student_attempts")
    .delete()
    .eq("student_id", user.id)
    .eq("test_id", tid);

  if (deleteError) {
    return {
      success: false,
      error: deleteError.message ?? "Не удалось сбросить предыдущую попытку",
    };
  }

  const { data: row, error: insertError } = await supabase
    .from("student_attempts")
    .insert({
      student_id: user.id,
      test_id: tid,
      status: "in_progress",
      started_at: new Date().toISOString(),
      is_training_mode: true,
    })
    .select("id")
    .single();

  if (!insertError && row) {
    return { success: true, attemptId: row.id };
  }

  return {
    success: false,
    error: insertError?.message ?? "Не удалось начать попытку в песочнице",
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
  /** Процент 0–100 в `student_attempts.score`. */
  score: number;
  /** Число полностью верных заданий. */
  correctCount: number;
  /** Количество заданий в тесте. */
  totalQuestions: number;
  earnedPoints: number;
  totalPossiblePoints: number;
  answeredCount: number;
  percentCorrect: number;
  isForKids: boolean;
  /** Попытка содержит развёрнутые ответы и ждёт проверки преподавателем. */
  requiresManualReview: boolean;
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

  if (question.type === "fill_in_the_blanks" || question.type === "fill_in_the_blanks_multi") {
    const payloadParsed =
      groupedFillAssignmentsAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для пропусков",
      };
    }

    const groupedAssignments =
      normalizeGroupedFillAssignmentsPayload(answerData);
    if (!groupedAssignments) {
      return {
        success: false,
        error: "Некорректные ответы для пропусков",
      };
    }

    const validation = validateGroupedFillAssignmentsSubmission({
      content: question.content,
      questionType: question.type,
      groupedAssignments,
    });
    if (!validation.ok) {
      return { success: false, error: validation.error };
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

    const answerJson: Json = { groupedFillAssignments: groupedAssignments };

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

  if (question.type === "fill_blanks_typing" || question.type === "fill_blanks_typing_multi") {
    const payloadParsed =
      groupedFillTypingAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для пропусков",
      };
    }

    const groupedTyping = normalizeGroupedFillTypingPayload(answerData);
    if (!groupedTyping) {
      return {
        success: false,
        error: "Некорректные ответы для пропусков",
      };
    }

    const validation = validateGroupedFillTypingSubmission({
      content: question.content,
      questionType: question.type,
      groupedTyping,
    });
    if (!validation.ok) {
      return { success: false, error: validation.error };
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

    const answerJson: Json = { groupedFillTyping: groupedTyping };

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

  if (question.type === "text_input") {
    const payloadParsed =
      groupedFillTypingAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для развёрнутого ответа",
      };
    }

    const groupedTyping = normalizeGroupedFillTypingPayload(answerData);
    if (!groupedTyping) {
      return {
        success: false,
        error: "Некорректные ответы для развёрнутого ответа",
      };
    }

    const validation = validateGroupedFillTypingSubmission({
      content: question.content,
      questionType: question.type,
      groupedTyping,
    });
    if (!validation.ok) {
      return { success: false, error: validation.error };
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

    const answerJson: Json = { groupedFillTyping: groupedTyping };

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

  if (
    isChoiceQuestionType(question.type) &&
    isGroupedChoiceContent(question.content)
  ) {
    const payloadParsed =
      groupedChoiceAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для задания",
      };
    }

    const items = parseGroupedChoiceItems(question.content);
    if (!items || items.length === 0) {
      return { success: false, error: "Вопрос повреждён (нет вопросов)" };
    }

    const selections = payloadParsed.data.groupedSelections;
    const isMultiple =
      question.type === "multiple_choice" || question.type === "multiple";

    for (const item of items) {
      const selected = selections[item.id];
      if (!Array.isArray(selected)) {
        return {
          success: false,
          error: "Ответьте на все вопросы задания",
        };
      }
      const uniqueSelected = [...new Set(selected)];
      const validOptionIds = new Set(item.options.map((o) => o.id));
      if (
        uniqueSelected.length !== selected.length ||
        uniqueSelected.some((id) => !validOptionIds.has(id))
      ) {
        return {
          success: false,
          error: "Выбран недопустимый вариант ответа",
        };
      }
      if (isMultiple) {
        if (uniqueSelected.length < 1) {
          return {
            success: false,
            error: "Выберите хотя бы один вариант в каждом вопросе",
          };
        }
      } else if (uniqueSelected.length !== 1) {
        return {
          success: false,
          error: "Выберите ровно один вариант в каждом вопросе",
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

    const answerJson: Json = { groupedSelections: selections };

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

  if (isOrderingQuestionType(question.type)) {
    const payloadParsed =
      groupedOrderingAnswerPayloadSchema.safeParse(answerData);
    if (!payloadParsed.success) {
      return {
        success: false,
        error:
          payloadParsed.error.issues[0]?.message ??
          "Некорректные ответы для упорядочивания",
      };
    }

    const playerView = resolveOrderingPlayerView({
      content: question.content,
    });
    if (!playerView) {
      return { success: false, error: "Вопрос повреждён (контент упорядочивания)" };
    }

    const assignments = payloadParsed.data.orderingAssignments;
    if (
      !isOrderingAssignmentsComplete(playerView.items, assignments)
    ) {
      return {
        success: false,
        error: "Выстройте порядок для каждого вопроса",
      };
    }

    for (const item of playerView.items) {
      const order = assignments[item.id];
      const validIds = new Set(item.elements.map((el) => el.id));
      if (
        !Array.isArray(order) ||
        order.length !== item.elements.length ||
        order.some((id) => !validIds.has(id)) ||
        new Set(order).size !== order.length
      ) {
        return {
          success: false,
          error: "Недопустимый порядок элементов",
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

    const answerJson: Json = { orderingAssignments: assignments };

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
 * Ответы попытки для экрана разбора (после `completed`).
 * Клиент сам парсит `answer_data` (например `labelPairs` для image_labeling).
 */
export async function getAttemptReviewAnswers(
  attemptId: string,
): Promise<
  | {
      success: true;
      data: {
        answers: {
          question_id: string;
          option_id: string;
          answer_data: Json | null;
          correct_option_ids: string[];
        }[];
        groupedCorrectByQuestionId: Record<string, Record<string, string[]>>;
      };
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

  if (attempt.status !== "completed" && attempt.status !== "pending_review") {
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
  const groupedCorrectByQuestionId: Record<string, Record<string, string[]>> =
    {};

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

    const { data: questionRows, error: questionErr } = await supabase
      .from("questions")
      .select("id, type, content")
      .in("id", questionIds);

    if (questionErr) {
      return { success: false, error: questionErr.message };
    }

    for (const q of questionRows ?? []) {
      if (q.type === "ordering") {
        const map = groupedCorrectOrderingMapFromContent(q.content);
        if (map) {
          groupedCorrectByQuestionId[q.id] = map;
        }
        continue;
      }
      if (!isChoiceQuestionType(q.type) || !isGroupedChoiceContent(q.content)) {
        continue;
      }
      const map = groupedCorrectMapFromContent(q.content);
      if (map) {
        groupedCorrectByQuestionId[q.id] = map;
      }
    }
  }

  return {
    success: true,
    data: {
      answers: (rows ?? []).map((r) => ({
        question_id: r.question_id,
        option_id: r.option_id,
        answer_data: r.answer_data,
        correct_option_ids: correctByQuestion.get(r.question_id) ?? [],
      })),
      groupedCorrectByQuestionId,
    },
  };
}

function countFillInTheBlanksSlots(content: Json | null): number {
  if (!content) return 1;

  const dndGrouped = parseGroupedFillBlanksItems(content, "dnd");
  if (dndGrouped?.length) {
    return dndGrouped.length;
  }
  const typingGrouped = parseGroupedFillBlanksItems(content, "typing");
  if (typingGrouped?.length) {
    return typingGrouped.length;
  }
  const textInputGrouped = parseGroupedFillBlanksItems(content, "text_input");
  if (textInputGrouped?.length) {
    return textInputGrouped.length;
  }

  const textInputParsed = TextInputContentSchema.safeParse(content);
  if (textInputParsed.success) {
    const n = blankIdsFromSegments(textInputParsed.data.segments).length;
    return n > 0 ? n : 1;
  }
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
    } else if (isFillGapQuestionType(q.type)) {
      n += countFillInTheBlanksSlots(q.content);
    } else {
      n += 1;
    }
  }
  return n;
}

function buildAttemptResult(params: {
  percentScore: number;
  correctCount: number;
  questionCount: number;
  earnedPoints: number;
  totalPossiblePoints: number;
  answeredCount: number;
  isForKids: boolean;
  requiresManualReview?: boolean;
}): AttemptResult {
  const percent = Math.max(0, Math.min(100, Math.round(params.percentScore)));
  return {
    score: percent,
    correctCount: params.correctCount,
    totalQuestions: params.questionCount,
    earnedPoints: params.earnedPoints,
    totalPossiblePoints: params.totalPossiblePoints,
    answeredCount: params.answeredCount,
    percentCorrect: percent,
    isForKids: params.isForKids,
    requiresManualReview: params.requiresManualReview ?? false,
  };
}

/**
 * Завершает попытку: статус `completed`, подсчёт баллов только на сервере.
 * Балл = процент 0–100 по весам `questions.points` (полностью верное задание).
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

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("is_for_kids")
    .eq("id", attempt.test_id)
    .single();

  if (testError || !testRow) {
    return { success: false, error: testError?.message ?? "Тест не найден" };
  }

  const isForKids = testRow.is_for_kids ?? false;

  const { data: questionRows, error: questionsFetchError } = await supabase
    .from("questions")
    .select("id, type, order_index, content, points")
    .eq("test_id", attempt.test_id)
    .order("order_index", { ascending: true });

  if (questionsFetchError) {
    return { success: false, error: questionsFetchError.message };
  }

  const questionsOrdered = questionRows ?? [];
  const questionCount = questionsOrdered.length;
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

  const totalPossiblePoints = Math.max(
    sumQuestionPoints(questionsOrdered, allOptions),
    1,
  );

  if (attempt.status === "completed" || attempt.status === "pending_review") {
    const percentScore = clampScorePercent(attempt.score);
    const { count: answered } = await supabase
      .from("attempt_answers")
      .select("id", { count: "exact", head: true })
      .eq("attempt_id", idResult.data);

    return {
      success: true,
      data: buildAttemptResult({
        percentScore,
        correctCount: Math.round(
          (percentScore / 100) * questionCount,
        ),
        questionCount,
        earnedPoints: Math.round(
          (percentScore / 100) * totalPossiblePoints,
        ),
        totalPossiblePoints,
        answeredCount: answered ?? 0,
        isForKids,
      }),
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

  const zeroResult = buildAttemptResult({
    percentScore: 0,
    correctCount: 0,
    questionCount,
    earnedPoints: 0,
    totalPossiblePoints,
    answeredCount: rows.length === 0 ? 0 : answeredCount,
    isForKids,
  });

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

    return { success: true, data: zeroResult };
  }

  const correctIdsByQuestion = new Map<string, string[]>();
  for (const qid of questionIds) {
    correctIdsByQuestion.set(qid, []);
  }
  for (const opt of allOptions) {
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

  let earnedPoints = 0;
  let correctCount = 0;

  const requiresManualReview = questionsOrdered.some(
    (q) => q.type === "text_input",
  );

  for (const q of questionsOrdered) {
    const listForQ = rowsByQuestionId.get(q.id);
    const answerRow = listForQ
      ? pickRepresentativeAttemptAnswerRow(q.type, listForQ)
      : undefined;
    const maxForQuestion = resolveQuestionMaxPoints(q, allOptions);
    const earnedForQuestion = getAttemptQuestionEarnedPoints(
      q,
      answerRow,
      allOptions,
      correctIdsByQuestion,
    );

    earnedPoints += earnedForQuestion;
    if (earnedForQuestion >= maxForQuestion) {
      correctCount += 1;
    }
  }

  const percentScore = clampScorePercent(
    totalPossiblePoints > 0
      ? Math.round((earnedPoints / totalPossiblePoints) * 100)
      : 0,
  );

  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("student_attempts")
    .update({
      status: requiresManualReview ? "pending_review" : "completed",
      score: percentScore,
      completed_at: completedAt,
    })
    .eq("id", idResult.data);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    data: buildAttemptResult({
      percentScore,
      correctCount,
      questionCount,
      earnedPoints,
      totalPossiblePoints,
      answeredCount,
      isForKids,
      requiresManualReview,
    }),
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
      raw += txt ? `[${txt}]` : "[]";
    }
  }
  return { fillRawText: raw, fillExtraWords: extraWords };
}

function extractExampleTextFromContent(content: Json): string {
  const parsed = z
    .object({ example_text: z.string().optional() })
    .safeParse(content);
  return parsed.success && parsed.data.example_text
    ? parsed.data.example_text
    : "";
}

function extractInstructionTextFromContent(content: Json): string {
  const textRoot = z.object({ text: z.string().optional() }).safeParse(content);
  const text = textRoot.success && textRoot.data.text ? textRoot.data.text : "";
  const audioRoot = z.object({ audio_url: z.string().optional() }).safeParse(content);
  const legacyAudio =
    audioRoot.success && audioRoot.data.audio_url ? audioRoot.data.audio_url : "";
  return mergeLegacyAudioUrlIntoHtml(text, legacyAudio);
}

function buildTextQuestionContent(content: {
  text: string;
  example_text?: string;
}): Json {
  const trimmedExample = content.example_text?.trim();
  return {
    text: content.text,
    ...(trimmedExample ? { example_text: trimmedExample } : {}),
  } as Json;
}

function mapTestSettingsToRow(d: SaveFullTestPayload) {
  return {
    title: d.title,
    description: d.description ?? null,
    folder_name: d.folder_name?.trim() ? d.folder_name.trim() : null,
    is_published: d.is_published ?? true,
    title_teacher: d.title_teacher?.trim() ? d.title_teacher.trim() : null,
    title_student: d.title_student?.trim() ? d.title_student.trim() : null,
    test_type: d.test_type,
    auto_check: d.auto_check,
    save_to_journal: d.save_to_journal,
    max_score: d.max_score,
    is_for_kids: d.is_for_kids,
    time_limit: d.time_limit ?? 0,
  };
}

function mapDbQuestionRowToQuestionField(row: {
  content: Json;
  type: string | null;
  points?: number | null;
  media_play_limit?: number | null;
  options?: {
    id: string;
    content: Json;
    order_index: number;
    is_correct: boolean | null;
  }[];
}): QuestionField {
  const points = resolveQuestionPoints(row.points);
  const exampleText = extractExampleTextFromContent(row.content);
  const instructionText = extractInstructionTextFromContent(row.content);
  const mediaPlayLimit = Math.max(0, row.media_play_limit ?? 0);
  const rawType = row.type ?? "single_choice";
  const type =
    rawType === "multiple" ? ("multiple_choice" as const) : rawType;

  const opts = [...(row.options ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  if (
    type === "fill_in_the_blanks" ||
    type === "fill_in_the_blanks_multi" ||
    type === "fill_blanks_typing" ||
    type === "fill_blanks_typing_multi" ||
    type === "text_input"
  ) {
    const mode = resolveGroupedFillBlanksMode(type);
    const groupedSchema =
      mode === "text_input"
        ? groupedTextInputContentSchema
        : mode === "dnd"
          ? groupedFillInTheBlanksContentSchema
          : groupedFillBlanksContentSchema;
    const groupedParsed = groupedSchema.safeParse(row.content);
    if (groupedParsed.success && groupedParsed.data.items?.length) {
      return {
        text: instructionText,
        type,
        points: sumGroupedFillBlanksPoints(groupedParsed.data.items),
        exampleText,
        mediaPlayLimit,
        items: groupedParsed.data.items.map((item) => {
          const normalizedText = normalizeGroupedFillBlanksItemText(item);
          const extraWords =
            mode === "dnd"
              ? extractExtraWordsFromFillContent({
                  segments: item.segments,
                  wordBank: item.wordBank,
                  correctMapping: item.correctMapping,
                })
              : [];
          const reparsed = parseGroupedFillBlanksItemText(
            normalizedText,
            mode,
            extraWords,
          );
          return {
            id: item.id,
            text: normalizedText,
            parsedHtml: reparsed?.parsedHtml ?? item.parsedHtml,
            points: resolveQuestionPoints(item.points),
            segments: reparsed?.segments ?? item.segments,
            wordBank: reparsed?.wordBank ?? item.wordBank,
            correctMapping: reparsed?.correctMapping ?? item.correctMapping,
            extraWords,
          };
        }),
      };
    }

    const flatParsed =
      type === "text_input"
        ? TextInputContentSchema.safeParse(row.content)
        : FillInTheBlanksContentSchema.safeParse(row.content);
    if (!flatParsed.success) {
      const defaultText =
        mode === "text_input"
          ? "<p>Ответьте на вопрос: []</p>"
          : "<p>Мама [мыла] раму.</p>";
      const parsedItem = parseGroupedFillBlanksItemText(defaultText, mode, []);
      return {
        text: instructionText,
        type,
        points,
        exampleText,
        mediaPlayLimit,
        items: [
          {
            id: newGroupedFillBlanksId(),
            text: defaultText,
            parsedHtml: parsedItem?.parsedHtml,
            points,
            segments: parsedItem?.segments ?? [],
            wordBank: parsedItem?.wordBank ?? [],
            correctMapping: parsedItem?.correctMapping ?? {},
            extraWords: [],
          },
        ],
      };
    }
    const { fillRawText, fillExtraWords } = fillContentToFormFields(
      flatParsed.data,
    );
    const legacyHtml = `<p>${fillRawText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
    const legacyParsed = parseGroupedFillBlanksItemText(legacyHtml, mode, fillExtraWords);
    return {
      text: instructionText,
      type,
      points,
      exampleText,
      mediaPlayLimit,
      items: [
        {
          id: LEGACY_GROUPED_FILL_ITEM_ID,
          text: legacyHtml,
          parsedHtml: legacyParsed?.parsedHtml,
          points,
          segments: legacyParsed?.segments ?? flatParsed.data.segments,
          wordBank: legacyParsed?.wordBank ?? flatParsed.data.wordBank,
          correctMapping:
            legacyParsed?.correctMapping ?? flatParsed.data.correctMapping,
          extraWords: fillExtraWords,
        },
      ],
    };
  }

  if (type === "matching_puzzle" || type === "dnd_puzzle") {
    const puzzleType: "matching_puzzle" | "dnd_puzzle" =
      type === "dnd_puzzle" ? "dnd_puzzle" : "matching_puzzle";
    return {
      text: instructionText,
      type: puzzleType,
      points,
      exampleText,
      mediaPlayLimit,
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
      text: instructionText,
      type: "image_labeling",
      points,
      exampleText,
      mediaPlayLimit,
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

  if (type === "ordering") {
    const groupedParsed = orderingContentSchema.safeParse(row.content);
    if (groupedParsed.success && groupedParsed.data.items?.length) {
      return {
        text: instructionText,
        type: "ordering",
        points: sumOrderingItemPoints(groupedParsed.data.items),
        exampleText,
        mediaPlayLimit,
        items: groupedParsed.data.items.map((item) => ({
          id: item.id,
          text: item.text ?? "",
          points: resolveQuestionPoints(item.points),
          elements: item.elements.map((el) => ({
            id: el.id,
            text: el.text,
          })),
        })),
      };
    }

    const el1 = newOrderingId();
    const el2 = newOrderingId();
    const defaultItem = {
      id: newOrderingId(),
      text: "",
      points: 1,
      elements: [
        { id: el1, text: "" },
        { id: el2, text: "" },
      ],
    };
    return {
      text: instructionText,
      type: "ordering",
      points: 1,
      exampleText,
      mediaPlayLimit,
      items: [defaultItem],
    };
  }

  const qType: "single_choice" | "multiple_choice" =
    type === "multiple_choice" ? "multiple_choice" : "single_choice";

  const groupedParsed = groupedChoiceContentSchema.safeParse(row.content);
  if (groupedParsed.success && groupedParsed.data.items?.length) {
    return {
      text: mergeLegacyAudioUrlIntoHtml(
        groupedParsed.data.text,
        typeof (row.content as Record<string, unknown>).audio_url === "string"
          ? String((row.content as Record<string, unknown>).audio_url)
          : "",
      ),
      type: qType,
      points: sumGroupedItemPoints(groupedParsed.data.items),
      exampleText,
      mediaPlayLimit,
      items: groupedParsed.data.items.map((item) => ({
        id: item.id,
        text: item.text,
        points: resolveQuestionPoints(item.points),
        options: item.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.is_correct,
          ...(o.image_url?.trim() ? { imageUrl: o.image_url.trim() } : {}),
        })),
      })),
    };
  }

  const legacyOptions = opts
    .filter((o) => {
      const c = o.content as { text?: unknown };
      return (
        c.text !== "__fill_in_the_blanks__" &&
        c.text !== GROUPED_CHOICE_ANCHOR_TEXT &&
        c.text !== GROUPED_FILL_BLANKS_ANCHOR_TEXT &&
        c.text !== GROUPED_ORDERING_ANCHOR_TEXT
      );
    })
    .map((o) => {
      const c = o.content as { text?: unknown };
      return {
        id: o.id,
        text: typeof c.text === "string" ? c.text : "",
        isCorrect: Boolean(o.is_correct),
      };
    });

  return {
    text: instructionText,
    type: qType,
    points,
    exampleText,
    mediaPlayLimit,
    items: [
      {
        id: LEGACY_GROUPED_ITEM_ID,
        text: instructionText,
        points,
        options: legacyOptions,
      },
    ],
  };
}

function hasGroupedFillBlanksItemsInPayload(
  q: SaveFullTestPayload["questions"][number],
): boolean {
  if (
    q.type !== "fill_in_the_blanks" &&
    q.type !== "fill_in_the_blanks_multi" &&
    q.type !== "fill_blanks_typing" &&
    q.type !== "fill_blanks_typing_multi" &&
    q.type !== "text_input"
  ) {
    return false;
  }
  const mode = resolveGroupedFillBlanksMode(q.type);
  const schema =
    mode === "text_input"
      ? groupedTextInputContentSchema
      : mode === "dnd"
        ? groupedFillInTheBlanksContentSchema
        : groupedFillBlanksContentSchema;
  const parsed = schema.safeParse(q.content);
  return Boolean(parsed.success && parsed.data.items && parsed.data.items.length > 0);
}

function hasGroupedOrderingItemsInPayload(
  q: SaveFullTestPayload["questions"][number],
): boolean {
  if (q.type !== "ordering") return false;
  const parsed = orderingContentSchema.safeParse(q.content);
  return Boolean(parsed.success && parsed.data.items && parsed.data.items.length > 0);
}

function hasGroupedChoiceItemsInPayload(
  q: SaveFullTestPayload["questions"][number],
): boolean {
  if (!isChoiceQuestionType(q.type)) return false;
  const parsed = groupedChoiceContentSchema.safeParse(q.content);
  return Boolean(parsed.success && parsed.data.items && parsed.data.items.length > 0);
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
      isFillGapQuestionType(q.type) ||
      hasGroupedChoiceItemsInPayload(q) ||
      hasGroupedOrderingItemsInPayload(q)
        ? (q.content as Json)
        : buildTextQuestionContent(
            q.content as { text: string; example_text?: string },
          ),
    order_index: i,
    type: q.type,
    points: resolveQuestionPoints(q.points),
    media_play_limit: Math.max(0, q.media_play_limit ?? 0),
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
    if (hasGroupedFillBlanksItemsInPayload(q)) {
      return [
        {
          question_id: qRow.id,
          content: { text: GROUPED_FILL_BLANKS_ANCHOR_TEXT } as Json,
          order_index: 0,
          is_correct: true,
        },
      ];
    }
    if (isFillGapQuestionType(q.type)) {
      return [
        {
          question_id: qRow.id,
          content: { text: "__fill_in_the_blanks__" } as Json,
          order_index: 0,
          is_correct: true,
        },
      ];
    }
    if (hasGroupedChoiceItemsInPayload(q)) {
      return [
        {
          question_id: qRow.id,
          content: { text: GROUPED_CHOICE_ANCHOR_TEXT } as Json,
          order_index: 0,
          is_correct: true,
        },
      ];
    }
    if (hasGroupedOrderingItemsInPayload(q)) {
      return [
        {
          question_id: qRow.id,
          content: { text: GROUPED_ORDERING_ANCHOR_TEXT } as Json,
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

function normalizeQuestionTypeForCompare(type: string | null): string {
  if (type === "multiple") return "multiple_choice";
  return type ?? "single_choice";
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function buildQuestionSignature(questions: {
  type: string | null;
  content: Json;
  points?: number | null;
  media_play_limit?: number | null;
  options: { order_index: number; content: Json; is_correct: boolean | null }[];
}[]): string[] {
  return questions.map((question) => {
    const optionsSignature = [...question.options]
      .sort((a, b) => a.order_index - b.order_index)
      .map((option) => ({
        content: option.content,
        is_correct: Boolean(option.is_correct),
      }));
    return `${normalizeQuestionTypeForCompare(question.type)}|points:${resolveQuestionPoints(question.points)}|media:${Math.max(0, question.media_play_limit ?? 0)}|${stableStringify(question.content)}|${stableStringify(optionsSignature)}`;
  });
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
      title_student,
      title_teacher,
      description,
      folder_name,
      user_id,
      title_teacher,
      title_student,
      test_type,
      auto_check,
      save_to_journal,
      max_score,
      is_for_kids,
      is_published,
      time_limit,
      questions (
        content,
        order_index,
        type,
        points,
        media_play_limit,
        options ( id, content, order_index, is_correct )
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
    folderName: data.folder_name ?? "",
    titleTeacher: data.title_teacher ?? "",
    titleStudent: data.title_student ?? "",
    testType: data.test_type === "training" ? "training" : "final",
    autoCheck: data.auto_check ?? true,
    saveToJournal: data.save_to_journal ?? true,
    maxScore: data.max_score ?? 100,
    timeLimit: data.time_limit ?? 0,
    isForKids: data.is_for_kids ?? false,
    isPublished: data.is_published ?? true,
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
  const d = parsed.data;

  const { data: testRow, error: testFetchErr } = await supabase
    .from("tests")
    .select(
      `
      id,
      user_id,
      questions (
        type,
        content,
        order_index,
        points,
        media_play_limit,
        options ( content, is_correct, order_index )
      )
    `,
    )
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

  const existingQuestions = [...(testRow.questions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      type: question.type,
      content: question.content,
      points: question.points,
      media_play_limit: question.media_play_limit,
      options: (question.options ?? []).map((option) => ({
        order_index: option.order_index,
        content: option.content,
        is_correct: option.is_correct,
      })),
    }));
  const incomingQuestions = d.questions.map((question) => ({
    type: question.type,
    content: question.content as Json,
    points: resolveQuestionPoints(question.points),
    media_play_limit: Math.max(0, question.media_play_limit ?? 0),
    options: question.options.map((option, index) => ({
      order_index: index,
      content: option.content as Json,
      is_correct: option.is_correct,
    })),
  }));
  const existingSignature = buildQuestionSignature(existingQuestions);
  const incomingSignature = buildQuestionSignature(incomingQuestions);
  const questionsAreChanging =
    existingSignature.length !== incomingSignature.length ||
    existingSignature.some((signature, index) => signature !== incomingSignature[index]);

  if (questionsAreChanging) {
    const { count: attemptCount, error: countErr } = await supabase
      .from("student_attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_id", tid)
      .neq("student_id", user.id);

    if (countErr) {
      return { success: false, error: countErr.message };
    }

    if ((attemptCount ?? 0) > 0) {
      return { success: false, error: attemptsBlockEditMessage };
    }
  }

  const { error: updateTestErr } = await supabase
    .from("tests")
    .update(mapTestSettingsToRow(d))
    .eq("id", tid);

  if (updateTestErr) {
    return { success: false, error: updateTestErr.message };
  }

  if (!questionsAreChanging) {
    revalidatePath("/dashboard/tests");
    revalidatePath(`/test/${tid}`);
    return { success: true, testId: tid };
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
      ...mapTestSettingsToRow(d),
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
