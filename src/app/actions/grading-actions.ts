"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getBestTestAttemptDetails,
  type GradebookBestAttemptDetails,
} from "@/app/actions/gradebook-actions";
import {
  getAttemptQuestionEarnedPoints,
  pickRepresentativeAttemptAnswerRow,
  resolveQuestionMaxPoints,
} from "@/lib/utils/scoring-utils";
import { mergeManualItemGradesIntoAnswerData } from "@/lib/manual-grading-utils";
import { resolveGroupedFillBlanksPlayerView } from "@/lib/grouped-fill-blanks-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchStudentEmailsByUserIds } from "@/lib/supabase/fetch-student-emails-admin";
import { createClient } from "@/lib/supabase/server";
import { clampScorePercent, sumQuestionPoints } from "@/lib/utils/grading";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Json } from "@/types/database.types";

export type AttemptGradingDetails = GradebookBestAttemptDetails & {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  testId: string;
};

export type GetPendingReviewCountsResult =
  | { success: true; counts: Record<string, number> }
  | { success: false; error: string };

const attemptIdSchema = z.string().uuid("Некорректный ID попытки");

const manualGradesSchema = z.record(
  z.string().min(1),
  z
    .number({ error: "Укажите баллы для всех развёрнутых ответов" })
    .int("Балл должен быть целым числом")
    .min(0, "Балл не может быть отрицательным"),
);

async function resolveCohortIdForTestStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  testId: string,
  studentId: string,
): Promise<string | null> {
  const { data: lessonRow, error: lessonError } = await supabase
    .from("lessons")
    .select("modules!inner(course_id)")
    .eq("test_id", testId)
    .limit(1)
    .maybeSingle();

  if (lessonError || !lessonRow) {
    return null;
  }

  const nested = lessonRow as unknown as {
    modules?: { course_id: string | null } | { course_id: string | null }[] | null;
  };
  const moduleRel = Array.isArray(nested.modules)
    ? nested.modules[0]
    : nested.modules;
  const courseId = moduleRel?.course_id;
  if (!courseId) {
    return null;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("course_id", courseId)
    .not("cohort_id", "is", null)
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollmentError || !enrollment?.cohort_id) {
    return null;
  }

  return enrollment.cohort_id;
}

export type SubmitManualGradesResult =
  | { success: true; percentScore: number; cohortId: string | null }
  | { success: false; error: string };

/** Число сдач на проверке по когортам: задания pending + тесты pending_review. */
export async function getPendingReviewCounts(): Promise<GetPendingReviewCountsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: rows, error } = await supabase.rpc("get_my_pending_review_counts");

  if (error) {
    console.error("[getPendingReviewCounts]", error.message);
    return { success: false, error: "Не удалось загрузить сдачи на проверку." };
  }

  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    if (!row.cohort_id) continue;
    // Postgres bigint / агрегаты иногда приходят строкой — Number() безопаснее, чем +value.
    const parsed = Number(row.pending_count);
    counts[row.cohort_id] = Number.isFinite(parsed) ? parsed : 0;
  }

  return { success: true, counts };
}

/** Данные для страницы ручной проверки конкретной попытки (`pending_review`). */
export async function getAttemptGradingDetails(
  attemptId: string,
): Promise<
  { success: true; data: AttemptGradingDetails } | { success: false; error: string }
> {
  const idParsed = attemptIdSchema.safeParse(attemptId);
  if (!idParsed.success) {
    return {
      success: false,
      error: idParsed.error.issues[0]?.message ?? "Некорректный ID попытки",
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

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin" &&
    profile.role !== "head_teacher"
  ) {
    return { success: false, error: "Недостаточно прав для проверки" };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("student_attempts")
    .select("id, student_id, test_id, status")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.status !== "pending_review") {
    return {
      success: false,
      error: "Эта попытка не ожидает ручной проверки",
    };
  }

  const detailsRes = await getBestTestAttemptDetails(
    attempt.student_id,
    attempt.test_id,
  );
  if (!detailsRes.success) {
    return detailsRes;
  }

  if (detailsRes.data.attemptId !== attempt.id) {
    return {
      success: false,
      error: "Не удалось загрузить данные попытки для проверки",
    };
  }

  const [studentProfileResult, emailsByUserId] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", attempt.student_id)
      .maybeSingle(),
    fetchStudentEmailsByUserIds([attempt.student_id]),
  ]);

  if (studentProfileResult.error) {
    return { success: false, error: studentProfileResult.error.message };
  }

  const studentName = resolveStudentDisplayName(
    studentProfileResult.data?.full_name,
    emailsByUserId.get(attempt.student_id) ?? null,
    attempt.student_id,
  );

  return {
    success: true,
    data: {
      ...detailsRes.data,
      studentId: attempt.student_id,
      studentName,
      studentAvatarUrl: studentProfileResult.data?.avatar_url ?? null,
      testId: attempt.test_id,
    },
  };
}

/**
 * Преподаватель выставляет баллы за развёрнутые ответы (`text_input`).
 * Ключи `itemGrades` — `itemId` подзадания (или `__legacy__` для старого формата).
 */
export async function submitManualGrades(
  attemptId: string,
  itemGrades: Record<string, number>,
): Promise<SubmitManualGradesResult> {
  const idParsed = attemptIdSchema.safeParse(attemptId);
  if (!idParsed.success) {
    return {
      success: false,
      error: idParsed.error.issues[0]?.message ?? "Некорректный ID попытки",
    };
  }

  const gradesParsed = manualGradesSchema.safeParse(itemGrades);
  if (!gradesParsed.success) {
    return {
      success: false,
      error:
        gradesParsed.error.issues[0]?.message ??
        "Некорректные баллы для ручной проверки",
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

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin" &&
    profile.role !== "head_teacher"
  ) {
    return { success: false, error: "Недостаточно прав для проверки" };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("student_attempts")
    .select("id, test_id, status, student_id")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (attemptError || !attempt) {
    return { success: false, error: "Попытка не найдена" };
  }

  if (attempt.status !== "pending_review") {
    return {
      success: false,
      error: "Эта попытка не ожидает ручной проверки",
    };
  }

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, user_id")
    .eq("id", attempt.test_id)
    .maybeSingle();

  if (testError || !testRow) {
    return { success: false, error: "Тест не найден" };
  }

  if (
    profile.role !== "admin" &&
    profile.role !== "head_teacher" &&
    testRow.user_id !== user.id
  ) {
    return {
      success: false,
      error: "Этот тест принадлежит другому преподавателю",
    };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      success: false,
      error:
        "Сервер не настроен для сохранения оценок (отсутствует SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .select("id, type, content, points")
    .eq("test_id", attempt.test_id)
    .order("order_index", { ascending: true });

  if (questionsError) {
    return { success: false, error: questionsError.message };
  }

  const questionsOrdered = questionRows ?? [];
  const textInputQuestions = questionsOrdered.filter((q) => q.type === "text_input");

  type ManualItemMeta = {
    questionId: string;
    maxPoints: number;
  };
  const itemMeta = new Map<string, ManualItemMeta>();

  for (const q of textInputQuestions) {
    const view = resolveGroupedFillBlanksPlayerView({
      content: q.content as Json,
      questionType: q.type,
      questionPoints: q.points,
    });
    if (!view) {
      return {
        success: false,
        error: "Не удалось разобрать вопрос с развёрнутым ответом",
      };
    }
    for (const item of view.items) {
      itemMeta.set(item.id, {
        questionId: q.id,
        maxPoints: item.points,
      });
    }
  }

  if (itemMeta.size === 0) {
    return {
      success: false,
      error: "В тесте нет заданий для ручной проверки",
    };
  }

  for (const itemId of itemMeta.keys()) {
    if (!(itemId in gradesParsed.data)) {
      return {
        success: false,
        error: "Укажите баллы для всех развёрнутых ответов",
      };
    }
  }

  for (const itemId of Object.keys(gradesParsed.data)) {
    if (!itemMeta.has(itemId)) {
      return {
        success: false,
        error: `Неизвестное подзадание: ${itemId}`,
      };
    }
  }

  for (const [itemId, awarded] of Object.entries(gradesParsed.data)) {
    const meta = itemMeta.get(itemId)!;
    if (awarded > meta.maxPoints) {
      return {
        success: false,
        error: `Балл за подзадание не может превышать ${meta.maxPoints}`,
      };
    }
  }

  const gradesByQuestion = new Map<string, Record<string, number>>();
  for (const [itemId, awarded] of Object.entries(gradesParsed.data)) {
    const meta = itemMeta.get(itemId)!;
    const bucket = gradesByQuestion.get(meta.questionId) ?? {};
    bucket[itemId] = awarded;
    gradesByQuestion.set(meta.questionId, bucket);
  }

  const { data: answerRows, error: answersError } = await supabase
    .from("attempt_answers")
    .select("id, question_id, option_id, answer_data")
    .eq("attempt_id", attempt.id);

  if (answersError) {
    return { success: false, error: answersError.message };
  }

  const rowsByQuestionId = new Map<
    string,
    {
      id: string;
      question_id: string;
      option_id: string;
      answer_data: Json | null;
    }[]
  >();
  for (const row of answerRows ?? []) {
    const list = rowsByQuestionId.get(row.question_id) ?? [];
    list.push(row);
    rowsByQuestionId.set(row.question_id, list);
  }

  for (const [questionId, grades] of gradesByQuestion) {
    const rowsForQ = rowsByQuestionId.get(questionId) ?? [];
    const representative = pickRepresentativeAttemptAnswerRow(
      "text_input",
      rowsForQ.map((r) => ({
        option_id: r.option_id,
        answer_data: r.answer_data,
      })),
    );
    if (!representative) {
      return {
        success: false,
        error: "Ответ ученика на развёрнутый вопрос не найден",
      };
    }

    const targetRow =
      rowsForQ.find(
        (r) =>
          r.option_id === representative.option_id &&
          r.answer_data === representative.answer_data,
      ) ?? rowsForQ[0];

    const mergedData = mergeManualItemGradesIntoAnswerData(
      targetRow.answer_data,
      grades,
    );

    const { data: updatedAnswer, error: updateErr } = await adminClient
      .from("attempt_answers")
      .update({ answer_data: mergedData })
      .eq("id", targetRow.id)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
    if (!updatedAnswer) {
      return {
        success: false,
        error: "Не удалось сохранить баллы в ответе ученика",
      };
    }

    targetRow.answer_data = mergedData;
  }

  const questionIds = questionsOrdered.map((q) => q.id);
  let allOptions: {
    id: string;
    question_id: string;
    is_correct: boolean | null;
    content: Json | null;
  }[] = [];

  if (questionIds.length > 0) {
    const { data: opts, error: optsErr } = await supabase
      .from("options")
      .select("id, question_id, is_correct, content")
      .in("question_id", questionIds);

    if (optsErr) {
      return { success: false, error: optsErr.message };
    }
    allOptions = opts ?? [];
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

  const totalPossiblePoints = Math.max(
    sumQuestionPoints(questionsOrdered, allOptions),
    1,
  );
  let earnedPoints = 0;
  let correctCount = 0;

  for (const q of questionsOrdered) {
    const listForQ = rowsByQuestionId.get(q.id) ?? [];
    const answerRow = listForQ.length
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

  const { data: finalizedAttempt, error: finalizeErr } = await adminClient
    .from("student_attempts")
    .update({
      status: "completed",
      score: percentScore,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (finalizeErr) {
    return { success: false, error: finalizeErr.message };
  }
  if (!finalizedAttempt) {
    return {
      success: false,
      error: "Не удалось завершить проверку попытки",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cohorts");
  revalidatePath("/learn");
  revalidatePath(`/dashboard/gradebook/attempts/${attempt.id}/grade`);

  const cohortId = await resolveCohortIdForTestStudent(
    supabase,
    attempt.test_id,
    attempt.student_id,
  );
  if (cohortId) {
    revalidatePath(`/dashboard/cohorts/${cohortId}`, "page");
  }

  return { success: true, percentScore, cohortId };
}
