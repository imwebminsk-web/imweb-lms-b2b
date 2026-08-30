import { getRecentActivity, type ActivityEvent } from "@/app/actions/activity-actions";
import { getPendingReviews, type PendingReviewItem } from "@/app/actions/teacher-dashboard-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminDashboardMetrics,
  DashboardSectionCard,
  TeacherDashboardMetrics,
} from "@/lib/dashboard/section-card";
import { type DashboardTableRow } from "@/lib/dashboard-table-schema";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRole = Database["public"]["Enums"]["profile_role"];
type DbClient = SupabaseClient<Database>;

function rlsBypassClient(fallback: DbClient): DbClient {
  return createAdminClient() ?? fallback;
}

/** PostgREST / URL parser struggle with very large `.in()` lists. */
const MAX_IN_FILTER_IDS = 500;

function sliceIdsForInFilter(ids: string[]): string[] {
  if (ids.length <= MAX_IN_FILTER_IDS) {
    return ids;
  }
  return ids.slice(0, MAX_IN_FILTER_IDS);
}

type AssignmentBlockContext = {
  courseTitle: string;
  lessonTitle: string;
  courseSlug: string;
};

export type { PendingReviewItem };

export type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: ProfileRole;
  createdAt: string | null;
  isActive: boolean;
};

export type DashboardData = {
  tableRows: DashboardTableRow[];
  sectionCards: DashboardSectionCard[];
  teacherMetrics?: TeacherDashboardMetrics;
  adminMetrics?: AdminDashboardMetrics;
  adminUsers?: AdminUserRow[];
  pendingReviews?: PendingReviewItem[];
  activityEvents?: ActivityEvent[];
};

async function fetchTeacherMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseIds: string[],
  userId: string,
): Promise<TeacherDashboardMetrics> {
  const totalCourses = courseIds.length;

  const assignmentBlockContext = await loadTeacherAssignmentBlockContextMap(
    supabase,
    userId,
  );
  const assignmentBlockIds = [...assignmentBlockContext.keys()];
  const dataClient = rlsBypassClient(supabase);

  const pendingTestReviewsQuery = dataClient
    .from("student_attempts")
    .select("id, tests!inner(user_id)", { count: "exact", head: true })
    .eq("status", "pending_review")
    .eq("is_training_mode", false)
    .eq("tests.user_id", userId);

  if (courseIds.length === 0) {
    const [
      pendingAssignments,
      { count: pendingTestAttempts, error: pendingTestsError },
    ] = await Promise.all([
      countPendingAssignmentReviewsForTeacher(supabase, assignmentBlockIds),
      pendingTestReviewsQuery,
    ]);

    if (pendingTestsError) {
      console.error(
        "[fetchDashboardData] teacher pending test reviews",
        JSON.stringify(pendingTestsError, null, 2),
      );
    }

    return {
      totalCourses: 0,
      totalCohorts: 0,
      totalStudents: 0,
      pendingReviews: pendingAssignments + (pendingTestAttempts ?? 0),
    };
  }

  const [
    { count: totalCohorts, error: cohortsError },
    { data: enrollmentRows, error: enrollmentsError },
    pendingAssignments,
    { count: pendingTestAttempts, error: pendingTestsError },
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select("*", { count: "exact", head: true })
      .in("course_id", courseIds)
      .eq("is_active", true),
    supabase.from("enrollments").select("user_id").in("course_id", courseIds),
    countPendingAssignmentReviewsForTeacher(supabase, assignmentBlockIds),
    pendingTestReviewsQuery,
  ]);

  if (cohortsError) {
    console.error("[fetchDashboardData] teacher cohorts", cohortsError.message);
  }
  if (enrollmentsError) {
    console.error(
      "[fetchDashboardData] teacher enrollments",
      enrollmentsError.message,
    );
  }
  if (pendingTestsError) {
    console.error(
      "[fetchDashboardData] teacher pending test reviews",
      JSON.stringify(pendingTestsError, null, 2),
    );
  }

  const totalStudents = new Set(
    (enrollmentRows ?? []).map((row) => row.user_id),
  ).size;

  return {
    totalCourses,
    totalCohorts: totalCohorts ?? 0,
    totalStudents,
    pendingReviews: pendingAssignments + (pendingTestAttempts ?? 0),
  };
}

function readCourseFromNestedRel(
  coursesRel:
    | { title: string | null; slug: string; teacher_id?: string }
    | { title: string | null; slug: string; teacher_id?: string }[]
    | null
    | undefined,
): { title: string | null; slug: string } | null {
  const course = Array.isArray(coursesRel) ? coursesRel[0] : coursesRel;
  if (!course?.slug) {
    return null;
  }
  return course;
}

/**
 * Контекст assignment-блоков преподавателя (один лёгкий запрос по lesson_blocks).
 * Дальше сдачи фильтруются по `lesson_block_id` без глубокого join на submissions.
 */
async function loadTeacherAssignmentBlockContextMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Map<string, AssignmentBlockContext>> {
  const map = new Map<string, AssignmentBlockContext>();

  const { data, error } = await supabase
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
    .eq("lessons.modules.courses.teacher_id", userId)
    .eq("content->>save_to_journal", "true");

  if (error) {
    console.error(
      "[getPendingReviewsForTeacher] assignment blocks",
      error.message,
    );
    return map;
  }

  for (const row of data ?? []) {
    const lessonRel = row.lessons as
      | {
          title: string | null;
          modules:
            | {
                courses:
                  | { title: string | null; slug: string }
                  | { title: string | null; slug: string }[]
                  | null;
              }
            | {
                courses:
                  | { title: string | null; slug: string }
                  | { title: string | null; slug: string }[]
                  | null;
              }[]
            | null;
        }
      | {
          title: string | null;
          modules:
            | {
                courses:
                  | { title: string | null; slug: string }
                  | { title: string | null; slug: string }[]
                  | null;
              }
            | {
                courses:
                  | { title: string | null; slug: string }
                  | { title: string | null; slug: string }[]
                  | null;
              }[]
            | null;
        }[]
      | null;
    const lesson = Array.isArray(lessonRel) ? lessonRel[0] : lessonRel;
    const moduleRel = lesson?.modules;
    const module = Array.isArray(moduleRel) ? moduleRel[0] : moduleRel;
    const course = readCourseFromNestedRel(module?.courses);
    if (!course) {
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

async function countPendingAssignmentReviewsForTeacher(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockIds: string[],
): Promise<number> {
  if (blockIds.length === 0) {
    return 0;
  }

  const safeBlockIds = sliceIdsForInFilter(blockIds);
  const client = rlsBypassClient(supabase);

  const { count, error } = await client
    .from("assignment_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("lesson_block_id", safeBlockIds);

  if (error) {
    console.error(
      "[fetchDashboardData] teacher pending assignment reviews",
      JSON.stringify(error, null, 2),
    );
    return 0;
  }

  return count ?? 0;
}

/**
 * Последние сдачи заданий и тестов, ожидающие проверки преподавателя.
 */
export async function getPendingReviewsForTeacher(
  _userId: string,
  limit = 5,
): Promise<PendingReviewItem[]> {
  const res = await getPendingReviews("mine", 0, limit);
  return res.success ? res.items : [];
}

async function fetchAuthCreatedAtByUserId(
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("[fetchAuthCreatedAtByUserId]", error.message);
      break;
    }

    for (const user of data.users) {
      if (user.created_at) {
        map.set(user.id, user.created_at);
      }
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return map;
}

export async function fetchAdminUsers(
  supabase: DbClient,
): Promise<AdminUserRow[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    // is_active ещё нет в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, full_name, avatar_url, role, is_active, profile_secrets(email)" as any)
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[fetchAdminUsers] profiles", error.message);
    return [];
  }

  const adminClient = createAdminClient();
  const createdAtById = adminClient
    ? await fetchAuthCreatedAtByUserId(adminClient)
    : new Map<string, string>();

  return (profiles ?? []).map((profile) => {
    const secret = profile.profile_secrets;
    const email =
      secret && !Array.isArray(secret) ? secret.email : null;

    return {
      id: profile.id,
      fullName: profile.full_name,
      email,
      avatarUrl: (profile as { avatar_url?: string | null }).avatar_url ?? null,
      role: profile.role,
      createdAt: createdAtById.get(profile.id) ?? null,
      isActive: (profile as { is_active?: boolean | null }).is_active !== false,
    };
  });
}

/**
 * Загружает строки таблицы и карточки по роли. Использует cookie-сессию Supabase (RLS).
 * Вызывать только из Server Components / route handlers, не передавать на клиент как action.
 */
export async function fetchDashboardData(
  userId: string,
  role: ProfileRole,
): Promise<DashboardData> {
  const supabase = await createClient();

  if (role === "teacher") {
    const { data: courses, error } = await supabase
      .from("courses")
      .select("id")
      .eq("teacher_id", userId);

    if (error) {
      console.error("[fetchDashboardData] teacher courses", error.message);
    }

    const courseIds = (courses ?? []).map((c) => c.id);

    const [teacherMetrics, activityEvents] = await Promise.all([
      fetchTeacherMetrics(supabase, courseIds, userId),
      getRecentActivity(userId, 15),
    ]);

    return {
      tableRows: [],
      sectionCards: [],
      teacherMetrics,
      activityEvents,
    };
  }

  if (role === "admin") {
    const [
      adminUsers,
      { count: studentsCount },
      { count: teachersCount },
      { count: coursesCount },
    ] = await Promise.all([
      fetchAdminUsers(supabase),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "teacher"),
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true }),
    ]);

    const adminMetrics: AdminDashboardMetrics = {
      totalStudents: studentsCount ?? 0,
      totalTeachers: teachersCount ?? 0,
      totalCourses: coursesCount ?? 0,
    };

    return {
      tableRows: [],
      sectionCards: [],
      adminMetrics,
      adminUsers,
    };
  }

  // head_teacher и прочие staff-роли без отдельной ветки:
  // каталог опубликованных курсов сюда больше не подмешиваем.
  return {
    tableRows: [],
    sectionCards: [],
  };
}
