import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

export const NOT_ENROLLED_IN_COURSE_ERROR =
  "Unauthorized: Not enrolled in this course";

export type CourseEnrollmentResult =
  | { ok: true; cohortId: string | null }
  | { ok: false; error: string };

function asCourseId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function courseIdFromModuleRel(modules: unknown): string | null {
  if (!modules) return null;
  const row = Array.isArray(modules) ? modules[0] : modules;
  if (!row || typeof row !== "object") return null;
  return asCourseId((row as { course_id?: unknown }).course_id);
}

function courseIdFromLessonRel(lessons: unknown): string | null {
  if (!lessons) return null;
  const row = Array.isArray(lessons) ? lessons[0] : lessons;
  if (!row || typeof row !== "object") return null;
  return courseIdFromModuleRel((row as { modules?: unknown }).modules);
}

/**
 * Есть ли у сотрудника B2B-назначение на курс
 * (глобальный курс / отдел / должность).
 */
async function userHasB2BCourseAssignment(
  client: DbClient,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { data: memberships, error: membershipsError } = await client
    .from("team_members")
    .select("team_id, job_title_id")
    .eq("user_id", userId);

  if (membershipsError) {
    console.error(
      "[userHasB2BCourseAssignment] team_members",
      membershipsError.message,
    );
    return false;
  }

  const rows = memberships ?? [];
  const teamIds = rows.map((row) => row.team_id);
  const jobTitleIds = rows
    .map((row) => row.job_title_id)
    .filter((id): id is string => Boolean(id));

  // is_global ещё нет в generated Database types.
  const { data: course, error: courseError } = await (
    client as SupabaseClient
  )
    .from("courses")
    .select("id, is_global")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    console.error("[userHasB2BCourseAssignment] courses", courseError.message);
  }

  const isGlobal = Boolean(
    (course as { is_global?: boolean | null } | null)?.is_global,
  );
  if (isGlobal && rows.length > 0) {
    return true;
  }

  if (teamIds.length > 0) {
    const { data: teamCourses, error: teamError } = await client
      .from("team_courses")
      .select("team_id")
      .eq("course_id", courseId)
      .in("team_id", teamIds);

    if (teamError) {
      console.error(
        "[userHasB2BCourseAssignment] team_courses",
        teamError.message,
      );
    } else if ((teamCourses ?? []).length > 0) {
      return true;
    }
  }

  if (jobTitleIds.length > 0) {
    const { data: jobCourses, error: jobError } = await client
      .from("job_title_courses")
      .select("job_title_id")
      .eq("course_id", courseId)
      .in("job_title_id", jobTitleIds);

    if (jobError) {
      console.error(
        "[userHasB2BCourseAssignment] job_title_courses",
        jobError.message,
      );
    } else if ((jobCourses ?? []).length > 0) {
      return true;
    }
  }

  return false;
}

async function readEnrollment(
  client: DbClient,
  userId: string,
  courseId: string,
): Promise<{ found: true; cohortId: string | null } | { found: false }> {
  const { data, error } = await client
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) {
    console.error("[readEnrollment]", error.message);
    return { found: false };
  }

  if (!data) {
    return { found: false };
  }

  return { found: true, cohortId: data.cohort_id ?? null };
}

/**
 * Если сотрудник назначен на курс в B2B, но строки в enrollments нет —
 * создаём её (admin-клиент обходит RLS).
 */
async function provisionB2BEnrollment(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const userClient = await createClient();
  const adminClient = createAdminClient();
  const reader = adminClient ?? userClient;

  const assigned = await userHasB2BCourseAssignment(reader, userId, courseId);
  if (!assigned) {
    return false;
  }

  const writer = adminClient ?? userClient;
  const { error: insertError } = await writer.from("enrollments").insert({
    user_id: userId,
    course_id: courseId,
    cohort_id: null,
  });

  if (
    insertError &&
    insertError.code !== "23505" &&
    !insertError.message.toLowerCase().includes("duplicate")
  ) {
    console.error("[provisionB2BEnrollment]", insertError.message);
    return false;
  }

  return true;
}

/**
 * Проверяет запись на курс. При валидном B2B-назначении создаёт enrollments.
 */
export async function ensureCourseEnrollment(
  userId: string,
  courseId: string,
): Promise<CourseEnrollmentResult> {
  const supabase = await createClient();
  const existing = await readEnrollment(supabase, userId, courseId);
  if (existing.found) {
    return { ok: true, cohortId: existing.cohortId };
  }

  const provisioned = await provisionB2BEnrollment(userId, courseId);
  if (!provisioned) {
    return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
  }

  const again = await readEnrollment(supabase, userId, courseId);
  if (!again.found) {
    const adminClient = createAdminClient();
    if (adminClient) {
      const adminRead = await readEnrollment(adminClient, userId, courseId);
      if (adminRead.found) {
        return { ok: true, cohortId: adminRead.cohortId };
      }
    }
    return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
  }

  return { ok: true, cohortId: again.cohortId };
}

async function privilegedReadClient(): Promise<DbClient> {
  return createAdminClient() ?? (await createClient());
}

export async function resolveCourseIdForLesson(
  lessonId: string,
): Promise<string | null> {
  const supabase = await privilegedReadClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("modules!inner(course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("[resolveCourseIdForLesson]", error.message);
    return null;
  }

  return courseIdFromModuleRel(data?.modules);
}

export async function resolveCourseIdForLessonBlock(
  lessonBlockId: string,
): Promise<string | null> {
  const supabase = await privilegedReadClient();
  const { data, error } = await supabase
    .from("lesson_blocks")
    .select("lessons!inner(modules!inner(course_id))")
    .eq("id", lessonBlockId)
    .maybeSingle();

  if (error) {
    console.error("[resolveCourseIdForLessonBlock]", error.message);
    return null;
  }

  return courseIdFromLessonRel(
    (data as { lessons?: unknown } | null)?.lessons,
  );
}

async function resolveCourseIdsForTest(testId: string): Promise<string[]> {
  const supabase = await privilegedReadClient();
  const courseIds = new Set<string>();

  const { data: lessonRows, error: lessonError } = await supabase
    .from("lessons")
    .select("modules!inner(course_id)")
    .eq("test_id", testId);

  if (lessonError) {
    console.error("[resolveCourseIdsForTest] lessons", lessonError.message);
  } else {
    for (const row of lessonRows ?? []) {
      const courseId = courseIdFromModuleRel(row.modules);
      if (courseId) courseIds.add(courseId);
    }
  }

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("lesson_block_id")
    .eq("id", testId)
    .maybeSingle();

  if (testError) {
    console.error("[resolveCourseIdsForTest] tests", testError.message);
  } else if (testRow?.lesson_block_id) {
    const fromBlock = await resolveCourseIdForLessonBlock(testRow.lesson_block_id);
    if (fromBlock) courseIds.add(fromBlock);
  }

  const { data: quizBlocks, error: quizError } = await supabase
    .from("lesson_blocks")
    .select("content, lessons!inner(modules!inner(course_id))")
    .eq("type", "quiz")
    .filter("content->>test_id", "eq", testId);

  if (quizError) {
    console.error("[resolveCourseIdsForTest] lesson_blocks", quizError.message);
  } else {
    for (const block of quizBlocks ?? []) {
      if (parseTestIdFromQuizBlockContent(block.content) !== testId) {
        continue;
      }
      const courseId = courseIdFromLessonRel(
        (block as { lessons?: unknown }).lessons,
      );
      if (courseId) courseIds.add(courseId);
    }
  }

  return [...courseIds];
}

export async function assertEnrolledForLesson(
  userId: string,
  lessonId: string,
): Promise<CourseEnrollmentResult> {
  const courseId = await resolveCourseIdForLesson(lessonId);
  if (!courseId) {
    return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
  }
  return ensureCourseEnrollment(userId, courseId);
}

export async function assertEnrolledForLessonBlock(
  userId: string,
  lessonBlockId: string,
): Promise<CourseEnrollmentResult> {
  const courseId = await resolveCourseIdForLessonBlock(lessonBlockId);
  if (!courseId) {
    return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
  }
  return ensureCourseEnrollment(userId, courseId);
}

/**
 * Для теста, встроенного в курс, нужна запись хотя бы на один такой курс.
 * Тест без привязки к уроку (публичный каталог) — enrollment не требуется.
 */
export async function assertEnrolledForTest(
  userId: string,
  testId: string,
  options?: { requireCourseBinding?: boolean },
): Promise<CourseEnrollmentResult> {
  const courseIds = await resolveCourseIdsForTest(testId);
  if (courseIds.length === 0) {
    if (options?.requireCourseBinding) {
      return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
    }
    return { ok: true, cohortId: null };
  }

  for (const courseId of courseIds) {
    const result = await ensureCourseEnrollment(userId, courseId);
    if (result.ok) {
      return result;
    }
  }

  return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
}

const STAFF_ROLES = new Set(["admin", "head_teacher", "teacher"]);

/**
 * Студент обязан быть записан, если тест принадлежит курсу.
 * Преподаватель / админ (песочница) — без проверки записи.
 */
export async function assertStudentEnrolledForTest(
  userId: string,
  testId: string,
): Promise<CourseEnrollmentResult> {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[assertStudentEnrolledForTest] profile", error.message);
    return { ok: false, error: NOT_ENROLLED_IN_COURSE_ERROR };
  }

  if (profile?.role && STAFF_ROLES.has(profile.role)) {
    return { ok: true, cohortId: null };
  }

  return assertEnrolledForTest(userId, testId);
}
