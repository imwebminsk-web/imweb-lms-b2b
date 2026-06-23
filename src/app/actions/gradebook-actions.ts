"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import { readBlockIsForKids, readBlockSaveToJournal } from "@/lib/gradebook/journal-utils";
import { normalizeStoredAssignmentPoints } from "@/lib/learn/assignment-grade-display";
import {
  clampScorePercent,
  getGradingVisuals,
  sumQuestionPoints,
  type GradingVisuals,
} from "@/lib/utils/grading";
import type { StudentProgressStatus } from "@/app/actions/student-dashboard-actions";
import type { AttemptResult, SafeTestQuestion } from "@/app/actions/test-actions";
import {
  getAttemptQuestionEarnedPoints,
  pickRepresentativeAttemptAnswerRow,
  resolveQuestionMaxPoints,
} from "@/lib/utils/scoring-utils";
import { resolveGroupedFillBlanksPlayerView } from "@/lib/grouped-fill-blanks-utils";
import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import { createClient } from "@/lib/supabase/server";
import { fetchStudentEmailsByUserIds } from "@/lib/supabase/fetch-student-emails-admin";
import type { ReviewAnswerRow } from "@/lib/learn/build-review-maps";
import type { Json } from "@/types/database.types";

const uuidSchema = z.string().uuid("Некорректный идентификатор");

export type ManualGradingTarget = {
  questionId: string;
  questionIndex: number;
  itemId: string;
  itemIndex: number;
  maxPoints: number;
  itemPreview: string;
};

export type AutoGradedQuestionScore = {
  questionId: string;
  questionIndex: number;
  type: string;
  earnedPoints: number;
  maxPoints: number;
};

export type GradebookBestAttemptDetails = {
  attemptId: string | null;
  attemptStatus: "in_progress" | "completed" | "pending_review" | null;
  score: number | null;
  completedAt: string | null;
  totalQuestions: number;
  totalPossiblePoints: number;
  /** Балл по попытке на шкале 0–100. */
  points: number | null;
  isForKids: boolean;
  gradingVisuals: GradingVisuals | null;
  /** Вопросы без `is_correct` на клиенте — как в прохождении теста. */
  questions: SafeTestQuestion[];
  /** Сводка для `QuizResultView` (как после `completeAttempt` для уже завершённой попытки). */
  resultSummary: AttemptResult | null;
  /** Строки ответов + верные option id по вопросу — для `buildReviewMaps`. */
  reviewAnswers: ReviewAnswerRow[];
  testTitle: string | null;
  testDescription: string | null;
  /** Подзадания text_input для ручной проверки (только при pending_review). */
  manualGradingTargets: ManualGradingTarget[];
  /** Автоматически проверенные вопросы с начисленными баллами. */
  autoGradedScores: AutoGradedQuestionScore[];
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
    .select("id, user_id, title, description, is_for_kids")
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
      "id, type, order_index, content, created_at, points, media_play_limit, options ( id, content, order_index, is_correct )",
    )
    .eq("test_id", tid.data)
    .order("order_index", { ascending: true });

  if (questionsError) {
    return { success: false, error: questionsError.message };
  }

  const questionsOrdered = questionsRaw ?? [];
  const totalQuestions = questionsOrdered.length;
  const totalPossiblePoints = Math.max(sumQuestionPoints(questionsOrdered), 1);
  const isForKids = testRow.is_for_kids ?? false;

  const { data: pendingAttempt, error: pendingError } = await supabase
    .from("student_attempts")
    .select("id, score, completed_at, status")
    .eq("student_id", sid.data)
    .eq("test_id", tid.data)
    .eq("status", "pending_review")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    return { success: false, error: pendingError.message };
  }

  let attempt = pendingAttempt;

  if (!attempt) {
    const { data: completedAttempt, error: attemptError } = await supabase
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
    attempt = completedAttempt;
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

  const rowsByQuestionId = new Map<string, typeof answerRows>();
  for (const row of answerRows) {
    const list = rowsByQuestionId.get(row.question_id) ?? [];
    list.push(row);
    rowsByQuestionId.set(row.question_id, list);
  }

  let allOptionsForScoring: {
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
    allOptionsForScoring = opts ?? [];
  }

  let earnedPointsTotal = 0;
  let correctCountTotal = 0;
  const manualGradingTargets: ManualGradingTarget[] = [];
  const autoGradedScores: AutoGradedQuestionScore[] = [];

  questionsOrdered.forEach((q, questionIndex) => {
    const listForQ = rowsByQuestionId.get(q.id) ?? [];
    const answerRow = listForQ.length
      ? pickRepresentativeAttemptAnswerRow(
          q.type,
          listForQ.map((r) => ({
            option_id: r.option_id ?? "",
            answer_data: r.answer_data,
          })),
        )
      : undefined;
    const maxPoints = resolveQuestionMaxPoints(q, allOptionsForScoring);
    const earnedForQuestion = getAttemptQuestionEarnedPoints(
      q,
      answerRow,
      allOptionsForScoring,
      correctByQuestion,
    );
    earnedPointsTotal += earnedForQuestion;
    if (earnedForQuestion >= maxPoints) {
      correctCountTotal += 1;
    }

    if (q.type === "text_input" && attempt?.status === "pending_review") {
      const view = resolveGroupedFillBlanksPlayerView({
        content: q.content as Json,
        questionType: q.type,
        questionPoints: q.points,
      });
      if (view) {
        view.items.forEach((item, itemIndex) => {
          const preview =
            item.segments
              .filter((s) => s.type === "text")
              .map((s) => s.value)
              .join("")
              .trim()
              .slice(0, 120) || `Подзадание ${itemIndex + 1}`;
          manualGradingTargets.push({
            questionId: q.id,
            questionIndex,
            itemId: item.id,
            itemIndex,
            maxPoints: item.points,
            itemPreview: preview,
          });
        });
      }
      return;
    }

    if (q.type !== "text_input") {
      autoGradedScores.push({
        questionId: q.id,
        questionIndex,
        type: q.type ?? "unknown",
        earnedPoints: earnedForQuestion,
        maxPoints,
      });
    }
  });

  const scoreVal = attempt?.score ?? 0;
  const scorePercent =
    attempt?.status === "pending_review" || attempt?.status === "in_progress"
      ? totalPossiblePoints > 0
        ? clampScorePercent(
            Math.round((earnedPointsTotal / totalPossiblePoints) * 100),
          )
        : 0
      : clampScorePercent(scoreVal);
  const points = attempt ? scorePercent : null;
  const gradingVisuals = attempt
    ? getGradingVisuals(scorePercent, isForKids, 100)
    : null;

  const answeredQuestionIds = new Set(answerRows.map((r) => r.question_id));
  const answeredCount = answeredQuestionIds.size;
  const resultSummary: AttemptResult | null = attempt
    ? {
        score: scorePercent,
        correctCount:
          attempt.status === "pending_review"
            ? correctCountTotal
            : Math.round((scorePercent / 100) * totalQuestions),
        totalQuestions,
        earnedPoints:
          attempt.status === "pending_review"
            ? earnedPointsTotal
            : Math.round((scorePercent / 100) * totalPossiblePoints),
        totalPossiblePoints,
        answeredCount,
        percentCorrect: scorePercent,
        isForKids,
        requiresManualReview: attempt.status === "pending_review",
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
      media_play_limit: q.media_play_limit ?? 0,
      points: q.points ?? null,
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
      attemptStatus: attempt?.status ?? null,
      score: attempt?.score ?? null,
      completedAt: attempt?.completed_at ?? null,
      totalQuestions,
      totalPossiblePoints,
      points,
      isForKids,
      gradingVisuals,
      questions,
      resultSummary,
      reviewAnswers,
      testTitle: testRow.title ?? null,
      testDescription: testRow.description ?? null,
      manualGradingTargets,
      autoGradedScores,
    },
  };
}

const pointsOverrideSchema = z.coerce.number().int().min(0).max(100);

/**
 * Преподаватель вручную выставляет балл 0–100 в `student_attempts.score`.
 */
export async function overrideTestAttemptGrade(
  attemptId: string,
  points: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const idParsed = uuidSchema.safeParse(attemptId);
  const pointsParsed = pointsOverrideSchema.safeParse(points);
  if (!idParsed.success) {
    return {
      success: false,
      error: idParsed.error.issues[0]?.message ?? "Некорректный ID попытки",
    };
  }
  if (!pointsParsed.success) {
    return {
      success: false,
      error: pointsParsed.error.issues[0]?.message ?? "Балл должен быть целым числом 0–100",
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

  const newScore = clampScorePercent(pointsParsed.data);

  const { error: updateError } = await supabase
    .from("student_attempts")
    .update({ score: newScore })
    .eq("id", idParsed.data);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { data: cohortRows } = await supabase
    .from("cohort_assignments")
    .select("cohort_id")
    .eq("test_id", attempt.test_id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cohorts");
  for (const row of cohortRows ?? []) {
    revalidatePath(`/dashboard/cohorts/${row.cohort_id}`, "page");
  }
  revalidatePath("/learn");
  return { success: true };
}

export type MatrixGradebookColumn = {
  id: string;
  type: "test" | "assignment";
  title: string;
  lessonTitle: string;
  lessonId: string;
  testId?: string;
  blockId?: string;
  /** Название теста для преподавателя (подсказка в матрице). */
  testTitleTeacher?: string | null;
  testType?: "training" | "final";
  isForKids?: boolean;
};

export type MatrixGradebookStudent = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type MatrixGradebookCell = {
  studentId: string;
  columnId: string;
  status: StudentProgressStatus;
  points: number | null;
  isForKids: boolean;
  gradingVisuals: GradingVisuals | null;
  testId: string | null;
  blockId: string | null;
  attemptId: string | null;
  submissionId: string | null;
};

export type MatrixGradebookData = {
  students: MatrixGradebookStudent[];
  columns: MatrixGradebookColumn[];
  cells: Record<string, MatrixGradebookCell>;
};

const cohortIdSchema = z.string().uuid("Некорректный ID группы");

function matrixCellKey(studentId: string, columnId: string): string {
  return `${studentId}:${columnId}`;
}

type GradebookTestMeta = {
  id: string;
  title: string;
  title_teacher: string | null;
  test_type: string;
  save_to_journal: boolean;
  is_published: boolean | null;
  is_for_kids: boolean;
};

function resolveGradebookTestType(
  testType: string | null | undefined,
): "training" | "final" {
  return testType === "training" ? "training" : "final";
}

function filterAndLabelTestColumns(
  columns: MatrixGradebookColumn[],
  testMetaById: Map<string, GradebookTestMeta>,
): MatrixGradebookColumn[] {
  return columns
    .filter((col) => {
      if (col.type !== "test" || !col.testId) return true;
      const meta = testMetaById.get(col.testId);
      if (!meta) return false;
      if (meta.is_published !== true) return false;
      if (!meta.save_to_journal) return false;
      return true;
    })
    .map((col) => {
      if (col.type !== "test" || !col.testId) return col;
      const meta = testMetaById.get(col.testId);
      const title = meta?.title?.trim() || "Тест";
      const teacherTitle =
        meta?.title_teacher?.trim() || meta?.title?.trim() || "Тест";
      return {
        ...col,
        title,
        testTitleTeacher: teacherTitle,
        testType: resolveGradebookTestType(meta?.test_type),
      };
    });
}

/**
 * Сводная матрица успеваемости группы: ученики × тесты/задания курса.
 */
export async function getMatrixGradebookData(
  cohortId: string,
): Promise<
  | { success: true; data: MatrixGradebookData }
  | { success: false; error: string }
> {
  const parsedCohort = cohortIdSchema.safeParse(cohortId.trim());
  if (!parsedCohort.success) {
    return {
      success: false,
      error: parsedCohort.error.issues[0]?.message ?? "Некорректный ID группы",
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
    return { success: false, error: "Нет доступа" };
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, course_id, courses(id, teacher_id)")
    .eq("id", parsedCohort.data)
    .maybeSingle();

  if (cohortError || !cohort) {
    return { success: false, error: "Группа не найдена" };
  }

  const courseRel = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
  if (!courseRel?.id) {
    return { success: false, error: "Курс не найден" };
  }

  if (courseRel.teacher_id !== user.id) {
    return { success: false, error: "Нет доступа к журналу этой группы" };
  }

  const courseId = cohort.course_id;

  const [
    { data: enrollmentsData, error: enrollmentsError },
    { data: assignmentRowsRaw, error: assignmentsError },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("user_id")
      .eq("cohort_id", parsedCohort.data)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("cohort_assignments")
      .select("lesson_id")
      .eq("cohort_id", parsedCohort.data),
  ]);

  if (enrollmentsError) {
    return { success: false, error: enrollmentsError.message };
  }
  if (assignmentsError) {
    return { success: false, error: assignmentsError.message };
  }

  const studentIds = (enrollmentsData ?? []).map((e) => e.user_id);
  const assignedLessonIds = new Set(
    (assignmentRowsRaw ?? [])
      .map((r) => r.lesson_id)
      .filter((v): v is string => Boolean(v)),
  );

  type EmailRow = { user_id: string; email: string | null; full_name: string | null };
  const emailByUserId = new Map<string, EmailRow>();

  try {
    const emailsByUserId = await fetchStudentEmailsByUserIds(studentIds);
    for (const [userId, email] of emailsByUserId) {
      emailByUserId.set(userId, {
        user_id: userId,
        email,
        full_name: null,
      });
    }
  } catch (emailsError) {
    console.error(
      "[getMatrixGradebookData] emails",
      emailsError instanceof Error ? emailsError.message : emailsError,
    );
  }

  const profileByUserId = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  if (studentIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", studentIds);
    for (const p of profileRows ?? []) {
      profileByUserId.set(p.id, {
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      });
    }
  }

  const students: MatrixGradebookStudent[] = studentIds.map((sid) => {
    const emailRow = emailByUserId.get(sid);
    const email = emailRow?.email?.trim() || "—";
    const profileRow = profileByUserId.get(sid);
    const fullName =
      profileRow?.full_name ?? emailRow?.full_name ?? null;
    return {
      id: sid,
      name: resolveStudentDisplayName(
        fullName,
        email === "—" ? null : email,
        sid,
      ),
      email,
      avatarUrl: profileRow?.avatar_url ?? null,
    };
  });

  const { data: lessonRowsRaw, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      "id, title, order_index, test_id, is_published, modules!inner(id, order_index, course_id)",
    )
    .eq("modules.course_id", courseId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (lessonsError) {
    return { success: false, error: lessonsError.message };
  }

  type LessonRow = {
    id: string;
    title: string;
    order_index: number;
    test_id: string | null;
    modules: { order_index: number } | { order_index: number }[];
  };

  const lessonsFiltered = ((lessonRowsRaw ?? []) as LessonRow[]).filter((lesson) => {
    if (assignedLessonIds.size === 0) return true;
    return assignedLessonIds.has(lesson.id);
  });

  lessonsFiltered.sort((a, b) => {
    const modA = Array.isArray(a.modules) ? a.modules[0] : a.modules;
    const modB = Array.isArray(b.modules) ? b.modules[0] : b.modules;
    const mo = (modA?.order_index ?? 0) - (modB?.order_index ?? 0);
    if (mo !== 0) return mo;
    return a.order_index - b.order_index;
  });

  const lessonIds = lessonsFiltered.map((l) => l.id);

  const { data: blockRowsRaw, error: blocksError } =
    lessonIds.length > 0
      ? await supabase
          .from("lesson_blocks")
          .select("id, lesson_id, order_index, type, content")
          .in("lesson_id", lessonIds)
          .in("type", ["assignment", "quiz"])
          .order("order_index", { ascending: true })
      : { data: [], error: null };

  if (blocksError) {
    return { success: false, error: blocksError.message };
  }

  type BlockRow = {
    id: string;
    lesson_id: string;
    order_index: number;
    type: string;
    content: Json;
  };

  const allBlocks = (blockRowsRaw ?? []) as BlockRow[];
  const blocksByLesson = new Map<string, BlockRow[]>();
  for (const b of allBlocks) {
    const list = blocksByLesson.get(b.lesson_id) ?? [];
    list.push(b);
    blocksByLesson.set(b.lesson_id, list);
  }

  const columns: MatrixGradebookColumn[] = [];
  const testIdSet = new Set<string>();

  for (const lesson of lessonsFiltered) {
    const lessonTitle = lesson.title.trim() || "Урок";
    const seenTests = new Set<string>();

    if (lesson.test_id) {
      seenTests.add(lesson.test_id);
      testIdSet.add(lesson.test_id);
      columns.push({
        id: `test-${lesson.id}-${lesson.test_id}`,
        type: "test",
        title: "Тест",
        lessonTitle,
        lessonId: lesson.id,
        testId: lesson.test_id,
      });
    }

    for (const block of blocksByLesson.get(lesson.id) ?? []) {
      if (block.type === "quiz") {
        const tid = parseTestIdFromQuizBlockContent(block.content);
        if (!tid || seenTests.has(tid)) continue;
        seenTests.add(tid);
        testIdSet.add(tid);
        columns.push({
          id: `test-${lesson.id}-block-${block.id}-${tid}`,
          type: "test",
          title: "Тест",
          lessonTitle,
          lessonId: lesson.id,
          testId: tid,
          blockId: block.id,
        });
      } else if (block.type === "assignment") {
        if (!readBlockSaveToJournal(block.content)) continue;
        columns.push({
          id: `assignment-${lesson.id}-${block.id}`,
          type: "assignment",
          title: "Задание",
          lessonTitle,
          lessonId: lesson.id,
          blockId: block.id,
          isForKids: readBlockIsForKids(block.content),
        });
      }
    }
  }

  const testMetaById = new Map<string, GradebookTestMeta>();
  const collectedTestIds = [...testIdSet];
  if (collectedTestIds.length > 0) {
    const { data: testMetaRows, error: testMetaErr } = await supabase
      .from("tests")
      .select(
        "id, title, title_teacher, test_type, save_to_journal, is_published, is_for_kids",
      )
      .in("id", collectedTestIds);
    if (testMetaErr) {
      return { success: false, error: testMetaErr.message };
    }
    for (const row of testMetaRows ?? []) {
      testMetaById.set(row.id, {
        id: row.id,
        title: row.title,
        title_teacher: row.title_teacher,
        test_type: row.test_type ?? "final",
        save_to_journal: row.save_to_journal,
        is_published: row.is_published,
        is_for_kids: row.is_for_kids ?? false,
      });
    }
  }

  const filteredColumns = filterAndLabelTestColumns(columns, testMetaById);
  const assignmentBlockIdsFiltered = filteredColumns
    .filter(
      (col): col is MatrixGradebookColumn & { blockId: string } =>
        col.type === "assignment" && Boolean(col.blockId),
    )
    .map((col) => col.blockId);
  const testIds = [
    ...new Set(
      filteredColumns
        .filter(
          (col): col is MatrixGradebookColumn & { testId: string } =>
            col.type === "test" && Boolean(col.testId),
        )
        .map((col) => col.testId),
    ),
  ];

  const cells: Record<string, MatrixGradebookCell> = {};

  for (const student of students) {
    for (const col of filteredColumns) {
      cells[matrixCellKey(student.id, col.id)] = {
        studentId: student.id,
        columnId: col.id,
        status: "not_started",
        points: null,
        isForKids: col.isForKids ?? false,
        gradingVisuals: null,
        testId: col.testId ?? null,
        blockId: col.blockId ?? null,
        attemptId: null,
        submissionId: null,
      };
    }
  }

  if (studentIds.length === 0 || filteredColumns.length === 0) {
    return {
      success: true,
      data: { students, columns: filteredColumns, cells },
    };
  }

  const isForKidsByTest = new Map<string, boolean>();
  for (const testId of testIds) {
    const meta = testMetaById.get(testId);
    if (meta) {
      isForKidsByTest.set(testId, meta.is_for_kids);
    }
  }

  if (testIds.length > 0) {
    const { data: attemptRows, error: attemptsErr } = await supabase
      .from("student_attempts")
      .select("id, student_id, test_id, score, status, completed_at")
      .in("student_id", studentIds)
      .in("test_id", testIds);

    if (attemptsErr) {
      return { success: false, error: attemptsErr.message };
    }

    type BestCompleted = {
      points: number;
      attemptId: string;
      gradingVisuals: GradingVisuals;
    };
    const bestCompleted = new Map<string, BestCompleted>();
    const inProgressKeys = new Set<string>();
    const pendingReviewByCell = new Map<string, string>();

    for (const a of attemptRows ?? []) {
      const matchingCols = filteredColumns.filter(
        (c) => c.type === "test" && c.testId === a.test_id,
      );
      const kids = isForKidsByTest.get(a.test_id) ?? false;
      const pts = clampScorePercent(a.score);
      const visuals = getGradingVisuals(pts, kids, 100);

      for (const col of matchingCols) {
        const cellKey = matrixCellKey(a.student_id, col.id);

        if (a.status === "completed") {
          const prev = bestCompleted.get(cellKey);
          if (!prev || pts > prev.points) {
            bestCompleted.set(cellKey, {
              points: pts,
              attemptId: a.id,
              gradingVisuals: visuals,
            });
          }
        } else if (a.status === "in_progress") {
          inProgressKeys.add(cellKey);
        } else if (a.status === "pending_review") {
          pendingReviewByCell.set(cellKey, a.id);
        }
      }
    }

    for (const [cellKey, best] of bestCompleted) {
      const cell = cells[cellKey];
      if (!cell) continue;
      cell.status = "completed";
      cell.points = best.points;
      cell.attemptId = best.attemptId;
      cell.isForKids = best.gradingVisuals.isForKids;
      cell.gradingVisuals = best.gradingVisuals;
    }

    for (const col of filteredColumns) {
      if (col.type !== "test" || !col.testId) continue;
      const kids = isForKidsByTest.get(col.testId) ?? false;
      if (!kids) continue;
      for (const student of students) {
        const cell = cells[matrixCellKey(student.id, col.id)];
        if (cell) cell.isForKids = true;
      }
    }

    for (const cellKey of inProgressKeys) {
      const cell = cells[cellKey];
      if (!cell || cell.status === "completed") continue;
      cell.status = "in_progress";
    }

    for (const [cellKey, attemptId] of pendingReviewByCell) {
      const cell = cells[cellKey];
      if (!cell) continue;
      cell.status = "pending";
      cell.attemptId = attemptId;
      cell.points = null;
      cell.gradingVisuals = null;
    }
  }

  if (assignmentBlockIdsFiltered.length > 0) {
    const { data: subRows, error: subErr } = await supabase
      .from("assignment_submissions")
      .select("id, student_id, lesson_block_id, status, grade, updated_at")
      .in("student_id", studentIds)
      .in("lesson_block_id", assignmentBlockIdsFiltered);

    if (subErr) {
      return { success: false, error: subErr.message };
    }

    const latestByStudentBlock = new Map<
      string,
      {
        id: string;
        status: StudentProgressStatus;
        grade: number | null;
        updated_at: string;
      }
    >();

    for (const s of subRows ?? []) {
      const mapKey = `${s.student_id}:${s.lesson_block_id}`;
      const prev = latestByStudentBlock.get(mapKey);
      if (
        !prev ||
        new Date(s.updated_at).getTime() > new Date(prev.updated_at).getTime()
      ) {
        latestByStudentBlock.set(mapKey, {
          id: s.id,
          status: s.status as StudentProgressStatus,
          grade: s.grade,
          updated_at: s.updated_at,
        });
      }
    }

    for (const col of filteredColumns) {
      if (col.type !== "assignment" || !col.blockId) continue;
      for (const student of students) {
        const mapKey = `${student.id}:${col.blockId}`;
        const sub = latestByStudentBlock.get(mapKey);
        const cellKey = matrixCellKey(student.id, col.id);
        const cell = cells[cellKey];
        if (!cell || !sub) continue;
        cell.status = sub.status;
        cell.submissionId = sub.id;
        if (sub.status === "approved" && sub.grade != null) {
          cell.points = normalizeStoredAssignmentPoints(sub.grade);
        }
        cell.isForKids = col.isForKids ?? false;
      }
    }
  }

  return { success: true, data: { students, columns: filteredColumns, cells } };
}
