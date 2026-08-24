"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchStudentEmailsByUserIds } from "@/lib/supabase/fetch-student-emails-admin";
import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;
type ProfileRole = Database["public"]["Enums"]["profile_role"];

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;
const MAX_IN_FILTER_IDS = 500;
const MAX_FETCH_WINDOW = 200;

const uuidSchema = z.string().uuid();

export type PendingReviewsFilter = "mine" | "others" | string;

export type PendingReviewItem =
  | {
      kind: "assignment";
      submissionId: string;
      studentName: string;
      courseTitle: string;
      lessonTitle: string;
      submittedAt: string;
      courseSlug: string;
    }
  | {
      kind: "test";
      attemptId: string;
      studentName: string;
      courseTitle: string;
      lessonTitle: string;
      submittedAt: string;
      courseSlug: string;
    };

export type StaffFilterOption = {
  id: string;
  fullName: string;
};

export type GetPendingReviewsResult =
  | { success: true; items: PendingReviewItem[]; hasMore: boolean }
  | { success: false; error: string };

type OwnerScope = { mode: "eq" | "neq"; ownerId: string };

type AssignmentBlockContext = {
  courseTitle: string;
  lessonTitle: string;
  courseSlug: string;
};

type CourseJoin = {
  title: string | null;
  slug: string;
  teacher_id?: string;
};

function rlsBypassClient(fallback: DbClient): DbClient {
  return createAdminClient() ?? fallback;
}

function sliceIdsForInFilter(ids: string[]): string[] {
  if (ids.length <= MAX_IN_FILTER_IDS) {
    return ids;
  }
  return ids.slice(0, MAX_IN_FILTER_IDS);
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function readCourseJoin(coursesRel: CourseJoin | CourseJoin[] | null | undefined): CourseJoin | null {
  const course = unwrapOne(coursesRel);
  if (!course?.slug) {
    return null;
  }
  return course;
}

function parseOwnerScope(
  filter: string,
  currentUserId: string,
  role: ProfileRole,
): OwnerScope | { error: string } {
  if (role === "teacher") {
    return { mode: "eq", ownerId: currentUserId };
  }

  if (filter === "mine") {
    return { mode: "eq", ownerId: currentUserId };
  }

  if (filter === "others") {
    return { mode: "neq", ownerId: currentUserId };
  }

  const parsed = uuidSchema.safeParse(filter);
  if (!parsed.success) {
    return { error: "Некорректный фильтр" };
  }

  return { mode: "eq", ownerId: parsed.data };
}

function matchesOwner(teacherId: string | null | undefined, scope: OwnerScope): boolean {
  if (!teacherId) {
    return false;
  }
  return scope.mode === "eq" ? teacherId === scope.ownerId : teacherId !== scope.ownerId;
}

/**
 * Имя для UI: profiles.full_name, иначе часть email до @.
 * Email берём той же утилитой, что и журнал (profile_secrets → Admin API).
 */
async function loadStudentDisplayNames(
  supabase: DbClient,
  studentIds: string[],
  logLabel: string,
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(studentIds.filter((id) => id.length > 0))];
  const nameById = new Map<string, string>();
  if (uniqueIds.length === 0) {
    return nameById;
  }

  const [profilesResult, emailsByUserId] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", uniqueIds),
    fetchStudentEmailsByUserIds(uniqueIds),
  ]);

  if (profilesResult.error) {
    console.error(`[getPendingReviews] ${logLabel} profiles`, profilesResult.error.message);
  }

  const profileNameByUserId = new Map<string, string | null>();
  for (const profile of profilesResult.data ?? []) {
    profileNameByUserId.set(profile.id, profile.full_name);
  }

  for (const id of uniqueIds) {
    nameById.set(
      id,
      resolveStudentDisplayName(
        profileNameByUserId.get(id),
        emailsByUserId.get(id) ?? null,
        id,
      ),
    );
  }

  return nameById;
}

async function loadAssignmentBlockContextMap(
  supabase: DbClient,
  scope: OwnerScope,
): Promise<Map<string, AssignmentBlockContext>> {
  const map = new Map<string, AssignmentBlockContext>();

  let query = supabase
    .from("lesson_blocks")
    .select(
      `
      id,
      lessons!inner(
        title,
        modules!inner(
          courses!inner(
            title,
            slug,
            teacher_id
          )
        )
      )
    `,
    )
    .eq("type", "assignment")
    .eq("content->>save_to_journal", "true");

  if (scope.mode === "eq") {
    query = query.eq("lessons.modules.courses.teacher_id", scope.ownerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getPendingReviews] assignment blocks", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const lesson = unwrapOne(
      row.lessons as
        | {
            title: string | null;
            modules:
              | { courses: CourseJoin | CourseJoin[] | null }
              | { courses: CourseJoin | CourseJoin[] | null }[]
              | null;
          }
        | {
            title: string | null;
            modules:
              | { courses: CourseJoin | CourseJoin[] | null }
              | { courses: CourseJoin | CourseJoin[] | null }[]
              | null;
          }[]
        | null,
    );
    const module = unwrapOne(lesson?.modules);
    const course = readCourseJoin(module?.courses);
    if (!course) {
      continue;
    }
    if (!matchesOwner(course.teacher_id, scope)) {
      continue;
    }

    map.set(row.id, {
      courseTitle: course.title?.trim() || "—",
      lessonTitle: lesson?.title?.trim() || "—",
      courseSlug: course.slug,
    });
  }

  return map;
}

async function buildPendingTestContextMap(
  supabase: DbClient,
  scope: OwnerScope,
  testIds: string[],
): Promise<Map<string, AssignmentBlockContext>> {
  const map = new Map<string, AssignmentBlockContext>();
  const uniqueTestIds = sliceIdsForInFilter(
    [...new Set(testIds.filter((id) => id.trim().length > 0))],
  );
  if (uniqueTestIds.length === 0) {
    return map;
  }

  let lessonsQuery = supabase
    .from("lessons")
    .select(
      `
      id,
      title,
      test_id,
      modules!inner(
        courses!inner(
          title,
          slug,
          teacher_id
        )
      )
    `,
    )
    .in("test_id", uniqueTestIds);

  if (scope.mode === "eq") {
    lessonsQuery = lessonsQuery.eq("modules.courses.teacher_id", scope.ownerId);
  }

  const { data: lessonRows, error: lessonsError } = await lessonsQuery;

  if (lessonsError) {
    console.error("[getPendingReviews] lessons", lessonsError.message);
  }

  for (const lesson of lessonRows ?? []) {
    if (!lesson.test_id) continue;
    const module = unwrapOne(
      lesson.modules as
        | { courses: CourseJoin | CourseJoin[] | null }
        | { courses: CourseJoin | CourseJoin[] | null }[]
        | null,
    );
    const course = readCourseJoin(module?.courses);
    if (!course) continue;
    if (!matchesOwner(course.teacher_id, scope)) continue;

    map.set(lesson.test_id, {
      lessonTitle: lesson.title?.trim() || "Урок",
      courseTitle: course.title?.trim() || "—",
      courseSlug: course.slug,
    });
  }

  const missingTestIds = sliceIdsForInFilter(
    uniqueTestIds.filter((testId) => !map.has(testId)),
  );
  if (missingTestIds.length === 0) {
    return map;
  }

  const orFilter = missingTestIds
    .map((testId) => `content->>test_id.eq.${testId}`)
    .join(",");

  let blocksQuery = supabase
    .from("lesson_blocks")
    .select(
      `
      content,
      lessons!inner(
        title,
        modules!inner(
          courses!inner(
            title,
            slug,
            teacher_id
          )
        )
      )
    `,
    )
    .eq("type", "quiz")
    .or(orFilter);

  if (scope.mode === "eq") {
    blocksQuery = blocksQuery.eq("lessons.modules.courses.teacher_id", scope.ownerId);
  }

  const { data: blockRows, error: blocksError } = await blocksQuery;

  if (blocksError) {
    console.error("[getPendingReviews] quiz blocks", blocksError.message);
    return map;
  }

  for (const block of blockRows ?? []) {
    const testId = parseTestIdFromQuizBlockContent(block.content);
    if (!testId || map.has(testId)) continue;

    const lesson = unwrapOne(
      block.lessons as
        | {
            title: string | null;
            modules:
              | { courses: CourseJoin | CourseJoin[] | null }
              | { courses: CourseJoin | CourseJoin[] | null }[]
              | null;
          }
        | null,
    );
    const module = unwrapOne(lesson?.modules);
    const course = readCourseJoin(module?.courses);
    if (!course) continue;
    if (!matchesOwner(course.teacher_id, scope)) continue;

    map.set(testId, {
      lessonTitle: lesson?.title?.trim() || "Урок",
      courseTitle: course.title?.trim() || "—",
      courseSlug: course.slug,
    });
  }

  return map;
}

async function fetchPendingAssignmentReviews(
  supabase: DbClient,
  scope: OwnerScope,
  fetchLimit: number,
): Promise<PendingReviewItem[]> {
  const blockContextById = await loadAssignmentBlockContextMap(supabase, scope);
  const blockIds = [...blockContextById.keys()];
  if (blockIds.length === 0) {
    return [];
  }

  const client = rlsBypassClient(supabase);
  const { data: rows, error } = await client
    .from("assignment_submissions")
    .select("id, created_at, student_id, lesson_block_id")
    .eq("status", "pending")
    .in("lesson_block_id", sliceIdsForInFilter(blockIds))
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    console.error("[getPendingReviews] submissions", error.message);
    return [];
  }

  const submissionRows = rows ?? [];
  const studentIds = [...new Set(submissionRows.map((row) => row.student_id))];
  const displayNameByUserId = await loadStudentDisplayNames(
    supabase,
    studentIds,
    "assignment",
  );

  const items: PendingReviewItem[] = [];
  for (const row of submissionRows) {
    const context = blockContextById.get(row.lesson_block_id);
    if (!context) continue;
    items.push({
      kind: "assignment",
      submissionId: row.id,
      studentName:
        displayNameByUserId.get(row.student_id) ??
        resolveStudentDisplayName(null, null, row.student_id),
      courseTitle: context.courseTitle,
      lessonTitle: context.lessonTitle,
      submittedAt: row.created_at,
      courseSlug: context.courseSlug,
    });
  }

  return items;
}

async function fetchPendingTestReviews(
  supabase: DbClient,
  scope: OwnerScope,
  fetchLimit: number,
): Promise<PendingReviewItem[]> {
  const dataClient = rlsBypassClient(supabase);

  let attemptsQuery = dataClient
    .from("student_attempts")
    .select(
      `
      id,
      completed_at,
      student_id,
      test_id,
      tests!inner(
        title,
        user_id
      )
    `,
    )
    .eq("status", "pending_review")
    .eq("is_training_mode", false)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  attemptsQuery =
    scope.mode === "eq"
      ? attemptsQuery.eq("tests.user_id", scope.ownerId)
      : attemptsQuery.neq("tests.user_id", scope.ownerId);

  const { data: rows, error } = await attemptsQuery;

  if (error) {
    console.error("[getPendingReviews] test attempts", error.message);
    return [];
  }

  const attemptRows = rows ?? [];
  if (attemptRows.length === 0) {
    return [];
  }

  const testContextById = await buildPendingTestContextMap(
    supabase,
    scope,
    attemptRows.map((row) => row.test_id),
  );

  const studentIds = [...new Set(attemptRows.map((row) => row.student_id))];
  const displayNameByUserId = await loadStudentDisplayNames(
    supabase,
    studentIds,
    "test",
  );

  const items: PendingReviewItem[] = [];
  for (const row of attemptRows) {
    const testMeta = unwrapOne(
      row.tests as
        | { title: string | null; user_id: string }
        | { title: string | null; user_id: string }[]
        | null,
    );
    const context = testContextById.get(row.test_id);
    items.push({
      kind: "test",
      attemptId: row.id,
      studentName:
        displayNameByUserId.get(row.student_id) ??
        resolveStudentDisplayName(null, null, row.student_id),
      courseTitle: context?.courseTitle ?? "—",
      lessonTitle: context?.lessonTitle ?? testMeta?.title?.trim() ?? "Тест",
      submittedAt: row.completed_at ?? new Date(0).toISOString(),
      courseSlug: context?.courseSlug ?? "",
    });
  }

  return items;
}

/**
 * Очередь проверки: задания (`pending`) и тесты (`pending_review`).
 * filter: mine | others | uuid владельца курса/теста.
 */
export async function getPendingReviews(
  filter: PendingReviewsFilter,
  offset: number,
  limit: number = PAGE_SIZE,
): Promise<GetPendingReviewsResult> {
  const offsetSafe = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const limitSafe = Number.isFinite(limit)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)))
    : PAGE_SIZE;

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
    return { success: false, error: "Недостаточно прав" };
  }

  const scope = parseOwnerScope(String(filter), user.id, profile.role);
  if ("error" in scope) {
    return { success: false, error: scope.error };
  }

  const fetchWindow = Math.min(offsetSafe + limitSafe + 1, MAX_FETCH_WINDOW);

  const [assignmentItems, testItems] = await Promise.all([
    fetchPendingAssignmentReviews(supabase, scope, fetchWindow),
    fetchPendingTestReviews(supabase, scope, fetchWindow),
  ]);

  const merged = [...assignmentItems, ...testItems].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  const page = merged.slice(offsetSafe, offsetSafe + limitSafe);
  const hasMore = merged.length > offsetSafe + limitSafe;

  return { success: true, items: page, hasMore };
}

/**
 * Список преподавателей и завучей для фильтра очереди проверки.
 */
export async function getStaffListForFilter(): Promise<
  { success: true; staff: StaffFilterOption[] } | { success: false; error: string }
> {
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

  if (profile.role !== "admin" && profile.role !== "head_teacher") {
    return { success: true, staff: [] };
  }

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["teacher", "head_teacher"])
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getStaffListForFilter]", error.message);
    return { success: false, error: error.message };
  }

  const staff: StaffFilterOption[] = [];
  for (const row of rows ?? []) {
    if (row.id === user.id) {
      continue;
    }
    staff.push({
      id: row.id,
      fullName: row.full_name?.trim() || "Сотрудник",
    });
  }

  return { success: true, staff };
}
