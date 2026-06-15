import { getRecentActivity, type ActivityEvent } from "@/app/actions/activity-actions";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardSectionCard,
  TeacherDashboardMetrics,
} from "@/lib/dashboard/section-card";
import {
  type DashboardTableRow,
  dashboardTableRowSchema,
} from "@/lib/dashboard-table-schema";
import { formatCoursePriceDecimal } from "@/lib/format-course-price";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

function uuidToStableNumber(id: string): number {
  const hex = id.replace(/-/g, "").slice(0, 8);
  return parseInt(hex, 16) % 2147483647;
}

function courseStatusLabel(
  status: Database["public"]["Enums"]["course_status"],
): "Опубликован" | "Черновик" {
  return status === "published" ? "Опубликован" : "Черновик";
}

function mapCourseRow(
  row: {
    id: string;
    title: string;
    status: Database["public"]["Enums"]["course_status"];
    level: Database["public"]["Enums"]["course_level"] | null;
    price: string | number | null;
    slug: string;
    language: string | null;
    teacher: { full_name: string | null } | { full_name: string | null }[] | null;
  },
): DashboardTableRow {
  const typeLabel =
    row.language?.trim() ||
    (row.level != null ? String(row.level) : "—");
  const teacherRel = row.teacher;
  const teacherName = Array.isArray(teacherRel)
    ? teacherRel[0]?.full_name
    : teacherRel?.full_name;
  return dashboardTableRowSchema.parse({
    id: uuidToStableNumber(row.id),
    header: row.title,
    type: typeLabel,
    status: courseStatusLabel(row.status),
    target: formatCoursePriceDecimal(row.price),
    limit: row.slug,
    slug: row.slug,
    reviewer: teacherName?.trim() || "—",
  });
}

/** Только данные для UI дашборда (без роли — её знает страница). */
export type PendingReviewItem = {
  submissionId: string;
  studentName: string;
  courseTitle: string;
  lessonTitle: string;
  submittedAt: string;
  courseSlug: string;
};

export type DashboardData = {
  tableRows: DashboardTableRow[];
  sectionCards: DashboardSectionCard[];
  teacherMetrics?: TeacherDashboardMetrics;
  pendingReviews?: PendingReviewItem[];
  activityEvents?: ActivityEvent[];
};

async function fetchTeacherMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseIds: string[],
  userId: string,
): Promise<TeacherDashboardMetrics> {
  const totalCourses = courseIds.length;

  const pendingAssignmentReviewsQuery = supabase
    .from("assignment_submissions")
    .select(
      "id, lesson_blocks!inner(lessons!inner(modules!inner(courses!inner(teacher_id))))",
      { count: "exact", head: true },
    )
    .eq("status", "pending")
    .eq("lesson_blocks.lessons.modules.courses.teacher_id", userId);

  const pendingTestReviewsQuery = supabase
    .from("student_attempts")
    .select("id, tests!inner(user_id)", { count: "exact", head: true })
    .eq("status", "pending_review")
    .eq("tests.user_id", userId);

  if (courseIds.length === 0) {
    const [
      { count: pendingAssignments, error: pendingAssignmentsError },
      { count: pendingTestAttempts, error: pendingTestsError },
    ] = await Promise.all([
      pendingAssignmentReviewsQuery,
      pendingTestReviewsQuery,
    ]);

    if (pendingAssignmentsError) {
      console.error(
        "[fetchDashboardData] teacher pending assignment reviews",
        JSON.stringify(pendingAssignmentsError, null, 2),
      );
    }
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
      pendingReviews: (pendingAssignments ?? 0) + (pendingTestAttempts ?? 0),
    };
  }

  const [
    { count: totalCohorts, error: cohortsError },
    { data: enrollmentRows, error: enrollmentsError },
    { count: pendingAssignments, error: pendingAssignmentsError },
    { count: pendingTestAttempts, error: pendingTestsError },
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select("*", { count: "exact", head: true })
      .in("course_id", courseIds)
      .eq("is_active", true),
    supabase.from("enrollments").select("user_id").in("course_id", courseIds),
    pendingAssignmentReviewsQuery,
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
  if (pendingAssignmentsError) {
    console.error(
      "[fetchDashboardData] teacher pending assignment reviews",
      JSON.stringify(pendingAssignmentsError, null, 2),
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
    pendingReviews: (pendingAssignments ?? 0) + (pendingTestAttempts ?? 0),
  };
}

type PendingSubmissionRow = {
  id: string;
  created_at: string;
  student_id: string;
  lesson_blocks: {
    lessons: {
      title: string;
      modules: {
        courses: {
          title: string;
          slug: string;
          teacher_id: string;
        } | null;
      } | null;
    } | null;
  } | null;
};

function readPendingSubmissionContext(row: PendingSubmissionRow): {
  courseTitle: string;
  lessonTitle: string;
  courseSlug: string;
} | null {
  const lesson = row.lesson_blocks?.lessons;
  const course = lesson?.modules?.courses;
  if (!course?.slug) {
    return null;
  }
  return {
    courseTitle: course.title?.trim() || "—",
    lessonTitle: lesson?.title?.trim() || "—",
    courseSlug: course.slug,
  };
}

/**
 * Последние сдачи заданий со статусом pending для курсов преподавателя.
 */
export async function getPendingReviewsForTeacher(
  userId: string,
  limit = 5,
): Promise<PendingReviewItem[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("assignment_submissions")
    .select(
      `
      id,
      created_at,
      student_id,
      lesson_blocks!inner(
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
      )
    `,
    )
    .eq("status", "pending")
    .eq("lesson_blocks.lessons.modules.courses.teacher_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      "[getPendingReviewsForTeacher]",
      JSON.stringify(error, null, 2),
    );
    return [];
  }

  const submissionRows = (rows ?? []) as PendingSubmissionRow[];
  const studentIds = [...new Set(submissionRows.map((row) => row.student_id))];

  const profileNameByUserId = new Map<string, string | null>();
  if (studentIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    if (profilesError) {
      console.error("[getPendingReviewsForTeacher] profiles", profilesError.message);
    }

    for (const profile of profileRows ?? []) {
      profileNameByUserId.set(profile.id, profile.full_name);
    }
  }

  const items: PendingReviewItem[] = [];

  for (const row of submissionRows) {
    const context = readPendingSubmissionContext(row);
    if (!context) {
      continue;
    }

    items.push({
      submissionId: row.id,
      studentName: resolveStudentDisplayName(
        profileNameByUserId.get(row.student_id),
        null,
        row.student_id,
      ),
      courseTitle: context.courseTitle,
      lessonTitle: context.lessonTitle,
      submittedAt: row.created_at,
      courseSlug: context.courseSlug,
    });
  }

  return items;
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

    const [teacherMetrics, pendingReviews, activityEvents] = await Promise.all([
      fetchTeacherMetrics(supabase, courseIds, userId),
      getPendingReviewsForTeacher(userId, 5),
      getRecentActivity(userId, 15),
    ]);

    return {
      tableRows: [],
      sectionCards: [],
      teacherMetrics,
      pendingReviews,
      activityEvents,
    };
  }

  if (role === "admin") {
    const { data: courses, error } = await supabase
      .from("courses")
      .select(
        "id, title, status, level, price, slug, language, teacher:profiles!courses_teacher_id_fkey ( full_name )",
      )
      .order("id", { ascending: false })
      .limit(80);

    if (error) {
      console.error("[fetchDashboardData] admin courses", error.message);
    }

    const tableRows = (courses ?? []).map((c) => mapCourseRow(c));

    const [{ count: studentsCount }, { count: teachersCount }, { count: pub }] =
      await Promise.all([
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
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
      ]);

    const sectionCards: DashboardSectionCard[] = [
      {
        label: "Студенты",
        value: String(studentsCount ?? 0),
        trendPercent: "+0%",
        trendUp: true,
        footerTitle: "Профили со ролью student",
        footerHint: "Источник: public.profiles",
      },
      {
        label: "Преподаватели",
        value: String(teachersCount ?? 0),
        trendPercent: "+0%",
        trendUp: true,
        footerTitle: "Профили teacher",
        footerHint: "Управление доступом через RLS",
      },
      {
        label: "Курсы в каталоге",
        value: String(pub ?? 0),
        trendPercent: `${pub ?? 0}`,
        trendUp: (pub ?? 0) > 0,
        footerTitle: "Опубликованные курсы",
        footerHint: "Транзакции оплат — отдельная таблица в PRD",
      },
      {
        label: "Все курсы (строки)",
        value: String((courses ?? []).length),
        trendPercent: "recent",
        trendUp: true,
        footerTitle: "Последние записи",
        footerHint: "Создания курсов; платежи — когда появится схема",
      },
    ];

    return { tableRows, sectionCards };
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select(
      "id, title, status, level, price, slug, language, teacher:profiles!courses_teacher_id_fkey ( full_name )",
    )
    .eq("status", "published")
    .order("title")
    .limit(40);

  if (error) {
    console.error("[fetchDashboardData] student catalog", error.message);
  }

  const tableRows = (courses ?? []).map((c) => mapCourseRow(c));

  const sectionCards: DashboardSectionCard[] = [
    {
      label: "Каталог",
      value: String((courses ?? []).length),
      trendPercent: "live",
      trendUp: true,
      footerTitle: "Опубликованные курсы",
      footerHint: "Просмотр и запись — по мере развития продукта",
    },
    {
      label: "Моё обучение",
      value: "0",
      trendPercent: "0%",
      trendUp: true,
      footerTitle: "Прогресс",
      footerHint: "Запись на курсы появится в следующих версиях",
    },
    {
      label: "Уровень",
      value: "—",
      trendPercent: "—",
      trendUp: true,
      footerTitle: "Персональные цели",
      footerHint: "Выберите курс из каталога",
    },
    {
      label: "Поддержка",
      value: "24/7",
      trendPercent: "FAQ",
      trendUp: true,
      footerTitle: "Нужна помощь?",
      footerHint: "Раздел Support в меню",
    },
  ];

  return { tableRows, sectionCards };
}
