import { readBlockSaveToJournal } from "@/lib/gradebook/journal-utils";
import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import type { Database, Json } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LessonCompletionGateState =
  | "completed"
  | "ready"
  | "blocked_not_passed"
  | "blocked_pending_review"
  | "blocked_assignment_not_submitted"
  | "blocked_assignment_rejected";

export type LessonCompletionGate = {
  state: LessonCompletionGateState;
};

type AttemptRow = {
  test_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
};

type SubmissionRow = {
  lesson_block_id: string;
  status: string;
  updated_at: string;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function attemptTimestamp(row: AttemptRow): number {
  const raw = row.completed_at ?? row.started_at;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickLatestAttemptByTest(
  rows: AttemptRow[],
): Map<string, AttemptRow> {
  const latest = new Map<string, AttemptRow>();
  for (const row of rows) {
    const prev = latest.get(row.test_id);
    if (!prev || attemptTimestamp(row) >= attemptTimestamp(prev)) {
      latest.set(row.test_id, row);
    }
  }
  return latest;
}

function pickLatestSubmissionByBlock(
  rows: SubmissionRow[],
): Map<string, SubmissionRow> {
  const latest = new Map<string, SubmissionRow>();
  for (const row of rows) {
    const prev = latest.get(row.lesson_block_id);
    const rowTime = Date.parse(row.updated_at);
    const prevTime = prev ? Date.parse(prev.updated_at) : Number.NEGATIVE_INFINITY;
    if (!prev || rowTime >= prevTime) {
      latest.set(row.lesson_block_id, row);
    }
  }
  return latest;
}

/**
 * Собирает UUID тестов урока: lessons.test_id + quiz-блоки.
 */
async function collectLessonTestIds(
  supabase: DbClient,
  lessonId: string,
): Promise<{ ok: true; testIds: string[] } | { ok: false; error: string }> {
  const [{ data: lesson, error: lessonError }, { data: blocks, error: blocksError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, test_id")
        .eq("id", lessonId)
        .maybeSingle(),
      supabase
        .from("lesson_blocks")
        .select("type, content")
        .eq("lesson_id", lessonId)
        .eq("type", "quiz"),
    ]);

  if (lessonError) {
    return { ok: false, error: lessonError.message };
  }
  if (blocksError) {
    return { ok: false, error: blocksError.message };
  }
  if (!lesson) {
    return { ok: false, error: "Урок не найден" };
  }

  const ids = new Set<string>();
  if (lesson.test_id && isUuid(lesson.test_id)) {
    ids.add(lesson.test_id);
  }
  for (const block of blocks ?? []) {
    const tid = parseTestIdFromQuizBlockContent(block.content as Json);
    if (tid && isUuid(tid)) {
      ids.add(tid);
    }
  }

  return { ok: true, testIds: [...ids] };
}

type GateResult = Exclude<LessonCompletionGateState, "completed">;

async function resolveFinalTestPart(
  supabase: DbClient,
  lessonId: string,
  userId: string,
): Promise<GateResult> {
  const collected = await collectLessonTestIds(supabase, lessonId);
  if (!collected.ok) {
    console.error("[resolveLessonCompletionGate] tests collect", collected.error);
    return "blocked_not_passed";
  }

  if (collected.testIds.length === 0) {
    return "ready";
  }

  const { data: finalTests, error: testsError } = await supabase
    .from("tests")
    .select("id")
    .in("id", collected.testIds)
    .eq("test_type", "final")
    .eq("is_published", true);

  if (testsError) {
    console.error("[resolveLessonCompletionGate] tests", testsError.message);
    return "blocked_not_passed";
  }

  const finalTestIds = (finalTests ?? []).map((row) => row.id);
  if (finalTestIds.length === 0) {
    return "ready";
  }

  const { data: attemptRows, error: attemptsError } = await supabase
    .from("student_attempts")
    .select("test_id, status, started_at, completed_at")
    .eq("student_id", userId)
    .in("test_id", finalTestIds)
    .eq("is_training_mode", false);

  if (attemptsError) {
    console.error(
      "[resolveLessonCompletionGate] attempts",
      attemptsError.message,
    );
    return "blocked_not_passed";
  }

  const latestByTest = pickLatestAttemptByTest((attemptRows ?? []) as AttemptRow[]);

  let hasPendingReview = false;
  for (const testId of finalTestIds) {
    const attempt = latestByTest.get(testId);
    if (!attempt || attempt.status === "in_progress") {
      return "blocked_not_passed";
    }
    if (attempt.status === "pending_review") {
      hasPendingReview = true;
    } else if (attempt.status !== "completed") {
      return "blocked_not_passed";
    }
  }

  if (hasPendingReview) {
    return "blocked_pending_review";
  }

  return "ready";
}

async function resolveAssignmentPart(
  supabase: DbClient,
  lessonId: string,
  userId: string,
): Promise<GateResult> {
  const { data: blocks, error: blocksError } = await supabase
    .from("lesson_blocks")
    .select("id, content")
    .eq("lesson_id", lessonId)
    .eq("type", "assignment");

  if (blocksError) {
    console.error(
      "[resolveLessonCompletionGate] assignment blocks",
      blocksError.message,
    );
    return "blocked_not_passed";
  }

  const requiredBlockIds = (blocks ?? [])
    .filter((block) => readBlockSaveToJournal(block.content as Json))
    .map((block) => block.id);

  if (requiredBlockIds.length === 0) {
    return "ready";
  }

  const { data: submissions, error: subError } = await supabase
    .from("assignment_submissions")
    .select("lesson_block_id, status, updated_at")
    .eq("student_id", userId)
    .in("lesson_block_id", requiredBlockIds);

  if (subError) {
    console.error(
      "[resolveLessonCompletionGate] assignment submissions",
      subError.message,
    );
    return "blocked_not_passed";
  }

  const latestByBlock = pickLatestSubmissionByBlock(
    (submissions ?? []) as SubmissionRow[],
  );

  let hasPending = false;
  let hasRejected = false;
  let hasMissing = false;

  for (const blockId of requiredBlockIds) {
    const sub = latestByBlock.get(blockId);
    if (!sub) {
      hasMissing = true;
      continue;
    }
    if (sub.status === "rejected") {
      hasRejected = true;
    } else if (sub.status === "pending") {
      hasPending = true;
    } else if (sub.status !== "approved") {
      hasMissing = true;
    }
  }

  if (hasMissing) {
    return "blocked_assignment_not_submitted";
  }
  if (hasRejected) {
    return "blocked_assignment_rejected";
  }
  if (hasPending) {
    return "blocked_pending_review";
  }

  return "ready";
}

function mergeGateParts(testState: GateResult, assignmentState: GateResult): GateResult {
  if (testState === "ready" && assignmentState === "ready") {
    return "ready";
  }

  if (assignmentState === "blocked_assignment_not_submitted") {
    return assignmentState;
  }
  if (assignmentState === "blocked_assignment_rejected") {
    return assignmentState;
  }
  if (testState === "blocked_not_passed") {
    return testState;
  }
  if (
    testState === "blocked_pending_review" ||
    assignmentState === "blocked_pending_review"
  ) {
    return "blocked_pending_review";
  }

  return testState !== "ready" ? testState : assignmentState;
}

export function isLessonCompletionBlocked(
  state: LessonCompletionGateState,
): boolean {
  return state !== "ready" && state !== "completed";
}

/**
 * Можно ли отметить урок завершённым: итоговые тесты сданы
 * и обязательные задания (save_to_journal) приняты.
 * Fail-closed: ошибка запроса = blocked_not_passed.
 */
export async function resolveLessonCompletionGate(
  supabase: DbClient,
  lessonId: string,
  userId: string,
): Promise<GateResult> {
  const [testState, assignmentState] = await Promise.all([
    resolveFinalTestPart(supabase, lessonId, userId),
    resolveAssignmentPart(supabase, lessonId, userId),
  ]);

  return mergeGateParts(testState, assignmentState);
}
