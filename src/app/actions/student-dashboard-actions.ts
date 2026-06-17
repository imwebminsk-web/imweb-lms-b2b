"use server";

import { z } from "zod";

import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import {
  normalizeAttemptScoreToPercent,
  percentToGrade10,
} from "@/lib/utils/grading";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const studentIdSchema = z.string().uuid("Некорректный ID пользователя");

/** Нормализует оценку из БД (0–10 или устаревшие 0–100) в балл 0–10. */
function assignmentGradeToGrade10(grade: number): number {
  if (grade >= 0 && grade <= 10) {
    return Math.round(grade);
  }
  if (grade > 10 && grade <= 100) {
    return Math.min(10, Math.max(0, Math.round((grade / 100) * 10)));
  }
  return Math.min(10, Math.max(0, Math.round(grade)));
}

/** Для `type: "test"`: завершённая попытка / только черновик / нет попыток. Для задания — статус сдачи. */
export type StudentProgressStatus =
  | "completed"
  | "in_progress"
  | "not_started"
  | "pending"
  | "approved"
  | "rejected";

export type StudentProgressItem = {
  id: string;
  type: "test" | "assignment";
  title: string;
  status: StudentProgressStatus;
  /** Балл 0–10: тест — по лучшей завершённой попытке; задание — после принятия (из оценки преподавателя). */
  grade10: number | null;
  courseId: string;
  courseSlug: string;
  /** Название курса из enrollments / join к lessons — для UI без разбора строки title. */
  courseTitle: string;
  lessonId: string;
  testId: string | null;
  lessonBlockId: string | null;
  /** Последняя сдача по блоку задания (для шторки). */
  assignmentSubmissionId: string | null;
  /** Есть завершённая попытка — можно открыть разбор (TestResultSheet). */
  hasCompletedTestAttempt: boolean;
  /** Тип теста для журнала преподавателя (только для type === "test"). */
  testType?: "training" | "final" | null;
};

type CourseRef = { id: string; slug: string; title: string };

/** Опубликованный урок курса студента с учётом когорты (как в getStudentProgress). */
type EnrolledLessonRow = {
  id: string;
  title: string;
  order_index: number;
  test_id: string | null;
  moduleOrder: number;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
};

export type StudentDashboardCourseSummary = {
  id: string;
  slug: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
};

async function loadEnrolledPublishedLessonsForStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentUserId: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; courseById: Map<string, CourseRef>; lessonsFlat: EnrolledLessonRow[] }
> {
  const { data: enrollRows, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id, cohort_id, courses(id, slug, title)")
    .eq("user_id", studentUserId);

  if (enrollError) {
    return { ok: false, error: enrollError.message };
  }

  const courseById = new Map<string, CourseRef>();
  for (const row of enrollRows ?? []) {
    const c = row.courses as CourseRef | CourseRef[] | null;
    const course = Array.isArray(c) ? c[0] : c;
    if (course?.id) {
      courseById.set(course.id, {
        id: course.id,
        slug: course.slug,
        title: course.title,
      });
    }
  }

  const courseIds = [...courseById.keys()];
  if (courseIds.length === 0) {
    return { ok: true, courseById, lessonsFlat: [] };
  }

  const cohortIds = [
    ...new Set(
      (enrollRows ?? [])
        .map((r) => r.cohort_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const cohortToLessonIds = new Map<string, Set<string>>();
  if (cohortIds.length > 0) {
    const { data: assignRows, error: assignError } = await supabase
      .from("cohort_assignments")
      .select("cohort_id, lesson_id")
      .in("cohort_id", cohortIds)
      .not("lesson_id", "is", null);

    if (assignError) {
      return { ok: false, error: assignError.message };
    }

    for (const row of assignRows ?? []) {
      const cohId = row.cohort_id;
      const lesId = row.lesson_id;
      if (!lesId) continue;
      let set = cohortToLessonIds.get(cohId);
      if (!set) {
        set = new Set();
        cohortToLessonIds.set(cohId, set);
      }
      set.add(lesId);
    }
  }

  const courseRestrictedLessonIds = new Map<string, Set<string>>();
  for (const row of enrollRows ?? []) {
    if (!row.cohort_id) continue;
    const fromCohort = cohortToLessonIds.get(row.cohort_id);
    if (!fromCohort || fromCohort.size === 0) continue;
    const merged =
      courseRestrictedLessonIds.get(row.course_id) ?? new Set<string>();
    for (const lid of fromCohort) merged.add(lid);
    courseRestrictedLessonIds.set(row.course_id, merged);
  }

  const { data: lessonRowsRaw, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      "id, title, order_index, test_id, is_published, module_id, modules!inner(id, order_index, course_id, courses!inner(id, slug, title))",
    )
    .in("modules.course_id", courseIds)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (lessonsError) {
    return { ok: false, error: lessonsError.message };
  }

  const lessonsFlat: EnrolledLessonRow[] = [];
  for (const row of lessonRowsRaw ?? []) {
    const mod = row.modules as unknown as {
      order_index: number;
      course_id: string;
      courses: { id: string; slug: string; title: string } | null;
    };
    const cid = mod?.course_id ?? "";
    const restricted = courseRestrictedLessonIds.get(cid);
    if (restricted && restricted.size > 0 && !restricted.has(row.id)) {
      continue;
    }
    const course = mod?.courses;
    const slug = course?.slug ?? courseById.get(mod.course_id)?.slug ?? "";
    const title = course?.title ?? courseById.get(mod.course_id)?.title ?? "";
    lessonsFlat.push({
      id: row.id,
      title: row.title,
      order_index: row.order_index,
      test_id: row.test_id,
      moduleOrder: mod?.order_index ?? 0,
      courseId: cid,
      courseSlug: slug,
      courseTitle: title,
    });
  }

  lessonsFlat.sort((a, b) => {
    if (a.courseId !== b.courseId) {
      return a.courseTitle.localeCompare(b.courseTitle, "ru");
    }
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    if (a.order_index !== b.order_index) return a.order_index - b.order_index;
    return a.id.localeCompare(b.id);
  });

  return { ok: true, courseById, lessonsFlat };
}

function fullAssignmentInstructions(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const instr = (content as Record<string, unknown>).instructions;
  return typeof instr === "string" ? instr.trim() : "";
}

function resolveProgressTestType(
  testType: string | null | undefined,
): "training" | "final" {
  return testType === "training" ? "training" : "final";
}

const cohortIdSchema = z.string().uuid("Некорректный ID группы");

type RpcStudentProgressRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  grade10: number | null;
  course_id: string;
  course_slug: string;
  course_title: string;
  lesson_id: string;
  test_id: string | null;
  lesson_block_id: string | null;
  assignment_submission_id: string | null;
  has_completed_test_attempt: boolean;
};

function mapRpcStudentProgressRows(
  rows: RpcStudentProgressRow[],
): StudentProgressItem[] {
  return rows.map((row) => ({
    id: row.id,
    type: row.type as StudentProgressItem["type"],
    title: row.title,
    status: row.status as StudentProgressStatus,
    grade10: row.grade10,
    courseId: row.course_id,
    courseSlug: row.course_slug,
    courseTitle: row.course_title,
    lessonId: row.lesson_id,
    testId: row.test_id,
    lessonBlockId: row.lesson_block_id,
    assignmentSubmissionId: row.assignment_submission_id,
    hasCompletedTestAttempt: row.has_completed_test_attempt,
  }));
}

async function fetchStudentProgressItemsForUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentUserId: string,
): Promise<
  { success: true; items: StudentProgressItem[] } | { success: false; error: string }
> {
  const loaded = await loadEnrolledPublishedLessonsForStudent(
    supabase,
    studentUserId,
  );
  if (!loaded.ok) {
    return { success: false, error: loaded.error };
  }

  const { courseById, lessonsFlat } = loaded;
  const courseIds = [...courseById.keys()];
  if (courseIds.length === 0) {
    return { success: true, items: [] };
  }

  const lessonIds = lessonsFlat.map((l) => l.id);

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

  const allBlockRows = (blockRowsRaw ?? []) as BlockRow[];
  const assignmentBlocks = allBlockRows.filter((b) => b.type === "assignment");

  const testIdSet = new Set<string>();
  for (const l of lessonsFlat) {
    if (l.test_id) testIdSet.add(l.test_id);
  }
  for (const b of allBlockRows) {
    if (b.type !== "quiz") continue;
    const tid = parseTestIdFromQuizBlockContent(b.content);
    if (tid) testIdSet.add(tid);
  }
  const testIds = [...testIdSet];

  // Всегда фильтруем попытки по ID ученика (не по сессии преподавателя):
  // getStudentProgress / getStudentProgressForTeacher передают сюда UUID студента.
  const attemptsPromise =
    testIds.length > 0
      ? supabase
          .from("student_attempts")
          .select("id, test_id, score, status, completed_at, started_at")
          .eq("student_id", studentUserId)
          .in("test_id", testIds)
      : Promise.resolve({ data: [], error: null });

  const questionsPromise =
    testIds.length > 0
      ? supabase.from("questions").select("test_id, points").in("test_id", testIds)
      : Promise.resolve({ data: [], error: null });

  const testsMetaPromise =
    testIds.length > 0
      ? supabase
          .from("tests")
          .select("id, test_type, title_teacher, title")
          .in("id", testIds)
      : Promise.resolve({ data: [], error: null });

  const [
    { data: attemptRowsRaw, error: attemptsErr },
    { data: questionRows, error: questionsErr },
    { data: testMetaRows, error: testsMetaErr },
  ] = await Promise.all([attemptsPromise, questionsPromise, testsMetaPromise]);
  if (attemptsErr || questionsErr || testsMetaErr) {
    return {
      success: false,
      error:
        attemptsErr?.message ??
        questionsErr?.message ??
        testsMetaErr?.message ??
        "Ошибка",
    };
  }

  const testTypeById = new Map<string, "training" | "final">();
  for (const row of testMetaRows ?? []) {
    testTypeById.set(row.id, resolveProgressTestType(row.test_type));
  }

  const questionCountByTest = new Map<string, number>();
  const pointsSumByTest = new Map<string, number>();
  for (const q of questionRows ?? []) {
    const prev = questionCountByTest.get(q.test_id) ?? 0;
    questionCountByTest.set(q.test_id, prev + 1);
    pointsSumByTest.set(
      q.test_id,
      (pointsSumByTest.get(q.test_id) ?? 0) +
        (q.points != null && q.points > 0 ? q.points : 1),
    );
  }

  const bestGrade10ByTest = new Map<string, number>();
  const hasCompletedByTest = new Set<string>();
  const hasInProgressByTest = new Set<string>();

  for (const a of attemptRowsRaw ?? []) {
    if (a.status === "completed") {
      hasCompletedByTest.add(a.test_id);
      const totalPoints = Math.max(pointsSumByTest.get(a.test_id) ?? 1, 1);
      const rawScore = a.score ?? 0;
      const percent = normalizeAttemptScoreToPercent(rawScore, totalPoints);
      const g10 = percentToGrade10(percent);
      const key = a.test_id;
      const prev = bestGrade10ByTest.get(key);
      if (prev == null || g10 > prev) {
        bestGrade10ByTest.set(key, g10);
      }
    }
    if (a.status === "in_progress") {
      hasInProgressByTest.add(a.test_id);
    }
  }

  type AssignmentBlockRow = {
    id: string;
    lesson_id: string;
    order_index: number;
    content: Json;
  };

  const blockIds = assignmentBlocks.map((b) => b.id);

  const latestSubmissionByBlock = new Map<
    string,
    { id: string; status: StudentProgressStatus; grade: number | null }
  >();

  if (blockIds.length > 0) {
    const { data: subRows, error: subErr } = await supabase
      .from("assignment_submissions")
      .select("id, lesson_block_id, status, grade, updated_at")
      .eq("student_id", studentUserId)
      .in("lesson_block_id", blockIds);

    if (subErr) {
      return { success: false, error: subErr.message };
    }

    const latestRowByBlock = new Map<
      string,
      {
        id: string;
        status: StudentProgressStatus;
        grade: number | null;
        updated_at: string;
      }
    >();
    for (const s of subRows ?? []) {
      const prev = latestRowByBlock.get(s.lesson_block_id);
      if (
        !prev ||
        new Date(s.updated_at).getTime() > new Date(prev.updated_at).getTime()
      ) {
        latestRowByBlock.set(s.lesson_block_id, {
          id: s.id,
          status: s.status as StudentProgressStatus,
          grade: s.grade,
          updated_at: s.updated_at,
        });
      }
    }
    for (const [blockId, row] of latestRowByBlock) {
      latestSubmissionByBlock.set(blockId, {
        id: row.id,
        status: row.status,
        grade: row.grade,
      });
    }
  }

  const blocksByLesson = new Map<string, AssignmentBlockRow[]>();
  for (const b of assignmentBlocks) {
    const row: AssignmentBlockRow = {
      id: b.id,
      lesson_id: b.lesson_id,
      order_index: b.order_index,
      content: b.content,
    };
    const list = blocksByLesson.get(b.lesson_id) ?? [];
    list.push(row);
    blocksByLesson.set(b.lesson_id, list);
  }
  for (const [, list] of blocksByLesson) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  type QuizBlockForLesson = { id: string; order_index: number; testId: string };
  const quizBlocksByLesson = new Map<string, QuizBlockForLesson[]>();
  for (const b of allBlockRows) {
    if (b.type !== "quiz") continue;
    const tid = parseTestIdFromQuizBlockContent(b.content);
    if (!tid) continue;
    const list = quizBlocksByLesson.get(b.lesson_id) ?? [];
    list.push({ id: b.id, order_index: b.order_index, testId: tid });
    quizBlocksByLesson.set(b.lesson_id, list);
  }
  for (const [, list] of quizBlocksByLesson) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  const items: StudentProgressItem[] = [];

  for (const lesson of lessonsFlat) {
    const seenTestIdsForLesson = new Set<string>();

    if (lesson.test_id) {
      seenTestIdsForLesson.add(lesson.test_id);
      const tid = lesson.test_id;
      const title = lesson.title.trim() || "Урок";

      let status: StudentProgressStatus = "not_started";
      let grade10: number | null = null;
      const hasCompleted = hasCompletedByTest.has(tid);

      if (hasCompleted) {
        grade10 = bestGrade10ByTest.get(tid) ?? null;
        status = "completed";
      } else if (hasInProgressByTest.has(tid)) {
        status = "in_progress";
      }

      items.push({
        id: `test-${lesson.id}-${tid}`,
        type: "test",
        title,
        status,
        grade10,
        courseId: lesson.courseId,
        courseSlug: lesson.courseSlug,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.id,
        testId: tid,
        lessonBlockId: null,
        assignmentSubmissionId: null,
        hasCompletedTestAttempt: hasCompleted,
        testType: testTypeById.get(tid) ?? "final",
      });
    }

    for (const qb of quizBlocksByLesson.get(lesson.id) ?? []) {
      if (seenTestIdsForLesson.has(qb.testId)) continue;
      seenTestIdsForLesson.add(qb.testId);
      const tid = qb.testId;
      const title = lesson.title.trim() || "Урок";

      let status: StudentProgressStatus = "not_started";
      let grade10: number | null = null;
      const hasCompleted = hasCompletedByTest.has(tid);

      if (hasCompleted) {
        grade10 = bestGrade10ByTest.get(tid) ?? null;
        status = "completed";
      } else if (hasInProgressByTest.has(tid)) {
        status = "in_progress";
      }

      items.push({
        id: `test-${lesson.id}-block-${qb.id}-${tid}`,
        type: "test",
        title,
        status,
        grade10,
        courseId: lesson.courseId,
        courseSlug: lesson.courseSlug,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.id,
        testId: tid,
        lessonBlockId: qb.id,
        assignmentSubmissionId: null,
        hasCompletedTestAttempt: hasCompleted,
        testType: testTypeById.get(tid) ?? "final",
      });
    }

    const blocks = blocksByLesson.get(lesson.id) ?? [];
    for (const block of blocks) {
      const sub = latestSubmissionByBlock.get(block.id);
      const title = lesson.title.trim() || "Урок";

      let status: StudentProgressStatus = "not_started";
      let grade10: number | null = null;
      if (sub) {
        status = sub.status;
        if (sub.status === "approved" && sub.grade != null) {
          grade10 = assignmentGradeToGrade10(sub.grade);
        }
      }

      items.push({
        id: `assignment-${lesson.id}-${block.id}`,
        type: "assignment",
        title,
        status,
        grade10,
        courseId: lesson.courseId,
        courseSlug: lesson.courseSlug,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.id,
        testId: null,
        lessonBlockId: block.id,
        assignmentSubmissionId: sub?.id ?? null,
        hasCompletedTestAttempt: false,
      });
    }
  }

  return { success: true, items };
}

/**
 * Прогресс ученика (сам ученик или админ).
 */
export async function getStudentProgress(
  studentId: string,
): Promise<
  { success: true; items: StudentProgressItem[] } | { success: false; error: string }
> {
  const parsed = studentIdSchema.safeParse(studentId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID",
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

  if (profile.role !== "admin" && user.id !== parsed.data) {
    return { success: false, error: "Нет доступа к чужому прогрессу" };
  }

  if (profile.role === "admin" && user.id !== parsed.data) {
    return fetchStudentProgressItemsForUserId(supabase, parsed.data);
  }

  const { data: rows, error } = await supabase.rpc("get_my_student_progress");

  if (error) {
    console.error("[getStudentProgress]", error.message);
    return { success: false, error: "Не удалось загрузить прогресс." };
  }

  return {
    success: true,
    items: mapRpcStudentProgressRows((rows ?? []) as RpcStudentProgressRow[]),
  };
}

export type StudentProgressForTeacherResult =
  | {
      success: true;
      items: StudentProgressItem[];
      courseId: string;
      courseTitle: string;
      courseSlug: string;
      cohortName: string;
    }
  | { success: false; error: string };

/**
 * Прогресс ученика для преподавателя: только если ученик в группе и курс принадлежит преподавателю.
 * Возвращает строки только по курсу этой группы (как вкладка «Успеваемость» у ученика на курсе).
 */
export async function getStudentProgressForTeacher(
  studentId: string,
  cohortId: string,
): Promise<StudentProgressForTeacherResult> {
  const parsedStudent = studentIdSchema.safeParse(studentId);
  const parsedCohort = cohortIdSchema.safeParse(cohortId);
  if (!parsedStudent.success) {
    return {
      success: false,
      error: parsedStudent.error.issues[0]?.message ?? "Некорректный ID",
    };
  }
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
    .select("id, name, course_id, courses(id, title, slug, teacher_id)")
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

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .select("id")
    .eq("cohort_id", parsedCohort.data)
    .eq("user_id", parsedStudent.data)
    .maybeSingle();

  if (enrollError) {
    return { success: false, error: enrollError.message };
  }
  if (!enrollment) {
    return { success: false, error: "Ученик не записан в эту группу" };
  }

  const progress = await fetchStudentProgressItemsForUserId(
    supabase,
    parsedStudent.data,
  );
  if (!progress.success) {
    return progress;
  }

  const courseId = cohort.course_id;
  const items = progress.items.filter((i) => i.courseId === courseId);

  return {
    success: true,
    items,
    courseId,
    courseTitle: courseRel.title ?? "",
    courseSlug: courseRel.slug ?? "",
    cohortName: cohort.name ?? "",
  };
}

/**
 * Сводка по курсам студента: сколько опубликованных (и разрешённых когортой) уроков и сколько отмечено в lesson_completions.
 */
export async function getStudentDashboardCourses(
  studentId: string,
): Promise<
  | { success: true; courses: StudentDashboardCourseSummary[] }
  | { success: false; error: string }
> {
  const parsed = studentIdSchema.safeParse(studentId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID",
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

  if (profile.role !== "admin" && user.id !== parsed.data) {
    return { success: false, error: "Нет доступа к чужим данным" };
  }

  const loaded = await loadEnrolledPublishedLessonsForStudent(
    supabase,
    parsed.data,
  );
  if (!loaded.ok) {
    return { success: false, error: loaded.error };
  }

  const { courseById, lessonsFlat } = loaded;

  const idsByCourse = new Map<string, string[]>();
  for (const l of lessonsFlat) {
    const arr = idsByCourse.get(l.courseId) ?? [];
    arr.push(l.id);
    idsByCourse.set(l.courseId, arr);
  }

  const allLessonIds = lessonsFlat.map((l) => l.id);
  const completedSet = new Set<string>();
  if (allLessonIds.length > 0) {
    const { data: compRows, error: compError } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("student_id", parsed.data)
      .in("lesson_id", allLessonIds);

    if (compError) {
      return { success: false, error: compError.message };
    }

    for (const row of compRows ?? []) {
      if (row.lesson_id) {
        completedSet.add(row.lesson_id);
      }
    }
  }

  const courses: StudentDashboardCourseSummary[] = [];
  for (const [courseId, ref] of courseById) {
    const ids = idsByCourse.get(courseId) ?? [];
    const totalLessons = ids.length;
    const completedLessons = ids.filter((id) => completedSet.has(id)).length;
    courses.push({
      id: courseId,
      slug: ref.slug,
      title: ref.title,
      totalLessons,
      completedLessons,
    });
  }

  courses.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  return { success: true, courses };
}
