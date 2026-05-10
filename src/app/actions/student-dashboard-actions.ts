"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const studentIdSchema = z.string().uuid("Некорректный ID пользователя");

const PASS_PERCENT = 60;

export type StudentProgressStatus =
  | "passed"
  | "failed"
  | "pending"
  | "approved"
  | "rejected"
  | "not_started";

export type StudentProgressItem = {
  id: string;
  type: "test" | "assignment";
  title: string;
  status: StudentProgressStatus;
  /** Процент по лучшей завершённой попытке теста; null если нет завершённой попытки. */
  scorePercent: number | null;
  /** Оценка за задание (после проверки). */
  grade: number | null;
  courseId: string;
  courseSlug: string;
  /** Название курса из enrollments / join к lessons — для UI без разбора строки title. */
  courseTitle: string;
  lessonId: string;
  testId: string | null;
  lessonBlockId: string | null;
  /** Есть завершённая попытка — можно открыть разбор (TestResultSheet). */
  hasCompletedTestAttempt: boolean;
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

/**
 * Прогресс ученика по курсам из записей на курс (enrollments): тесты уроков и блоки assignment.
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

  const loaded = await loadEnrolledPublishedLessonsForStudent(
    supabase,
    parsed.data,
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

  const testIds = [
    ...new Set(lessonsFlat.map((l) => l.test_id).filter((v): v is string => Boolean(v))),
  ];

  const blocksPromise =
    lessonIds.length > 0
      ? supabase
          .from("lesson_blocks")
          .select("id, lesson_id, order_index, type, content")
          .in("lesson_id", lessonIds)
          .eq("type", "assignment")
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const testsPromise =
    testIds.length > 0
      ? supabase.from("tests").select("id, title").in("id", testIds)
      : Promise.resolve({ data: [], error: null });

  const attemptsPromise =
    testIds.length > 0
      ? supabase
          .from("student_attempts")
          .select("id, test_id, score, status, completed_at, started_at")
          .eq("student_id", parsed.data)
          .in("test_id", testIds)
      : Promise.resolve({ data: [], error: null });

  const questionsPromise =
    testIds.length > 0
      ? supabase.from("questions").select("test_id").in("test_id", testIds)
      : Promise.resolve({ data: [], error: null });

  const [
    { data: blockRowsRaw, error: blocksError },
    { data: testTitleRows, error: testsErr },
    { data: attemptRowsRaw, error: attemptsErr },
    { data: questionRows, error: questionsErr },
  ] = await Promise.all([
    blocksPromise,
    testsPromise,
    attemptsPromise,
    questionsPromise,
  ]);

  if (blocksError) {
    return { success: false, error: blocksError.message };
  }
  if (testsErr || attemptsErr || questionsErr) {
    return {
      success: false,
      error: testsErr?.message ?? attemptsErr?.message ?? questionsErr?.message ?? "Ошибка",
    };
  }

  const testTitleById = new Map<string, string>();
  for (const t of testTitleRows ?? []) {
    testTitleById.set(t.id, t.title);
  }

  const questionCountByTest = new Map<string, number>();
  for (const q of questionRows ?? []) {
    const prev = questionCountByTest.get(q.test_id) ?? 0;
    questionCountByTest.set(q.test_id, prev + 1);
  }

  const attempts = attemptRowsRaw ?? [];
  const bestPercentByTest = new Map<string, number>();
  const hasCompletedByTest = new Set<string>();
  const hasInProgressByTest = new Set<string>();

  for (const a of attemptRowsRaw ?? []) {
    if (a.status === "completed") {
      hasCompletedByTest.add(a.test_id);
      const total = questionCountByTest.get(a.test_id) ?? 0;
      if (total > 0) {
        const rawScore = a.score ?? 0;
        const percent = Math.max(
          0,
          Math.min(100, Math.round((rawScore / total) * 100)),
        );
        const key = a.test_id;
        const prev = bestPercentByTest.get(key);
        if (prev == null || percent > prev) {
          bestPercentByTest.set(key, percent);
        }
      }
    }
    if (a.status === "in_progress") {
      hasInProgressByTest.add(a.test_id);
    }
  }

  type BlockRow = {
    id: string;
    lesson_id: string;
    order_index: number;
    content: Json;
  };

  const assignmentBlocks = (blockRowsRaw ?? []) as BlockRow[];
  const blockIds = assignmentBlocks.map((b) => b.id);

  const latestSubmissionByBlock = new Map<
    string,
    { status: StudentProgressStatus; grade: number | null }
  >();

  if (blockIds.length > 0) {
    const { data: subRows, error: subErr } = await supabase
      .from("assignment_submissions")
      .select("lesson_block_id, status, grade, updated_at")
      .eq("student_id", parsed.data)
      .in("lesson_block_id", blockIds);

    if (subErr) {
      return { success: false, error: subErr.message };
    }

    const latestRowByBlock = new Map<
      string,
      { status: StudentProgressStatus; grade: number | null; updated_at: string }
    >();
    for (const s of subRows ?? []) {
      const prev = latestRowByBlock.get(s.lesson_block_id);
      if (
        !prev ||
        new Date(s.updated_at).getTime() > new Date(prev.updated_at).getTime()
      ) {
        latestRowByBlock.set(s.lesson_block_id, {
          status: s.status as StudentProgressStatus,
          grade: s.grade,
          updated_at: s.updated_at,
        });
      }
    }
    for (const [blockId, row] of latestRowByBlock) {
      latestSubmissionByBlock.set(blockId, {
        status: row.status,
        grade: row.grade,
      });
    }
  }

  const blocksByLesson = new Map<string, BlockRow[]>();
  for (const b of assignmentBlocks) {
    const list = blocksByLesson.get(b.lesson_id) ?? [];
    list.push(b);
    blocksByLesson.set(b.lesson_id, list);
  }
  for (const [, list] of blocksByLesson) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  const items: StudentProgressItem[] = [];

  for (const lesson of lessonsFlat) {
    if (lesson.test_id) {
      const tid = lesson.test_id;
      const testTitle = testTitleById.get(tid) ?? "Тест";
      const title = `${lesson.courseTitle} · ${lesson.title} · ${testTitle}`;

      let status: StudentProgressStatus = "not_started";
      let scorePercent: number | null = null;
      const hasCompleted = hasCompletedByTest.has(tid);

      if (hasCompleted) {
        scorePercent = bestPercentByTest.get(tid) ?? null;
        const p = scorePercent ?? 0;
        status = p >= PASS_PERCENT ? "passed" : "failed";
      } else if (hasInProgressByTest.has(tid)) {
        status = "pending";
      }

      items.push({
        id: `test-${lesson.id}-${tid}`,
        type: "test",
        title,
        status,
        scorePercent,
        grade: null,
        courseId: lesson.courseId,
        courseSlug: lesson.courseSlug,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.id,
        testId: tid,
        lessonBlockId: null,
        hasCompletedTestAttempt: hasCompleted,
      });
    }

    const blocks = blocksByLesson.get(lesson.id) ?? [];
    for (const block of blocks) {
      const sub = latestSubmissionByBlock.get(block.id);
      const instrFull = fullAssignmentInstructions(block.content);
      const clip = instrFull.slice(0, 40);
      const title = instrFull
        ? `${lesson.courseTitle} · ${lesson.title} · ${clip}${instrFull.length > 40 ? "…" : ""}`
        : `${lesson.courseTitle} · ${lesson.title} · Задание`;

      let status: StudentProgressStatus = "not_started";
      let grade: number | null = null;
      if (sub) {
        status = sub.status;
        grade = sub.grade;
      }

      items.push({
        id: `assignment-${lesson.id}-${block.id}`,
        type: "assignment",
        title,
        status,
        scorePercent: null,
        grade,
        courseId: lesson.courseId,
        courseSlug: lesson.courseSlug,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.id,
        testId: null,
        lessonBlockId: block.id,
        hasCompletedTestAttempt: false,
      });
    }
  }

  return { success: true, items };
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
