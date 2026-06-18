"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

function rlsBypassClient(fallback: DbClient): DbClient {
  return createAdminClient() ?? fallback;
}

export type ActivityEvent = {
  id: string;
  type: "enrollment" | "test" | "assignment";
  title: string;
  description: string;
  date: string;
  studentName: string;
};

type RawActivityEvent = {
  id: string;
  type: ActivityEvent["type"];
  title: string;
  description: string;
  date: string;
  studentId: string;
};

const MAX_RECENT_ACTIVITY_QUERY_LIMIT = 20;

function normalizeActivityLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), MAX_RECENT_ACTIVITY_QUERY_LIMIT);
}

async function loadTeacherAssignmentBlockTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
): Promise<Map<string, string>> {
  const titleByBlockId = new Map<string, string>();

  const { data, error } = await supabase
    .from("lesson_blocks")
    .select(
      `
      id,
      lessons!inner(
        title,
        modules!inner(
          courses!inner(teacher_id)
        )
      )
    `,
    )
    .eq("type", "assignment")
    .eq("lessons.modules.courses.teacher_id", teacherId);

  if (error) {
    console.error(
      "[getRecentActivity] assignment blocks",
      error.message,
    );
    return titleByBlockId;
  }

  for (const row of data ?? []) {
    const lessonRel = row.lessons as
      | { title: string | null }
      | { title: string | null }[]
      | null;
    const lesson = Array.isArray(lessonRel) ? lessonRel[0] : lessonRel;
    titleByBlockId.set(
      row.id,
      lesson?.title?.trim() || "урок",
    );
  }

  return titleByBlockId;
}

async function attachStudentNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  events: RawActivityEvent[],
): Promise<ActivityEvent[]> {
  if (events.length === 0) {
    return [];
  }

  const studentIds = [...new Set(events.map((event) => event.studentId))];
  const profileNameByUserId = new Map<string, string | null>();

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", studentIds);

  if (profilesError) {
    console.error("[getRecentActivity] profiles", profilesError.message);
  }

  for (const profile of profileRows ?? []) {
    profileNameByUserId.set(profile.id, profile.full_name);
  }

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    date: event.date,
    studentName: resolveStudentDisplayName(
      profileNameByUserId.get(event.studentId),
      null,
      event.studentId,
    ),
  }));
}

/**
 * Последние события активности учеников на курсах преподавателя.
 */
export async function getRecentActivity(
  teacherId: string,
  limit = 15,
): Promise<ActivityEvent[]> {
  const tid = teacherId.trim();
  if (!tid) {
    return [];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return [];
  }

  if (profile.role !== "admin" && user.id !== tid) {
    return [];
  }

  const fetchLimit = normalizeActivityLimit(limit);
  const assignmentTitlesByBlockId = await loadTeacherAssignmentBlockTitles(
    supabase,
    tid,
  );
  const assignmentBlockIds = [...assignmentTitlesByBlockId.keys()];
  const dataClient = rlsBypassClient(supabase);

  const [
    { data: enrollmentRows, error: enrollmentsError },
    { data: attemptRows, error: attemptsError },
    { data: submissionRows, error: submissionsError },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        `
        id,
        enrolled_at,
        user_id,
        cohorts!inner(
          name,
          courses!inner(teacher_id)
        )
      `,
      )
      .eq("cohorts.courses.teacher_id", tid)
      .order("enrolled_at", { ascending: false })
      .limit(fetchLimit),
    dataClient
      .from("student_attempts")
      .select(
        `
        id,
        status,
        completed_at,
        score,
        student_id,
        test_id,
        tests!inner(
          id,
          title,
          user_id
        )
      `,
      )
      .eq("tests.user_id", tid)
      .eq("status", "completed")
      .eq("is_training_mode", false)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(fetchLimit),
    assignmentBlockIds.length > 0
      ? dataClient
          .from("assignment_submissions")
          .select(
            "id, status, created_at, student_id, lesson_block_id",
          )
          .in("lesson_block_id", assignmentBlockIds)
          .order("created_at", { ascending: false })
          .limit(fetchLimit)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (enrollmentsError) {
    console.error("[getRecentActivity] enrollments", enrollmentsError.message);
  }
  if (attemptsError) {
    console.error("[getRecentActivity] attempts", attemptsError.message);
  }
  if (submissionsError) {
    console.error("[getRecentActivity] submissions", submissionsError.message);
  }

  const attemptStudentIds = [
    ...new Set((attemptRows ?? []).map((row) => row.student_id)),
  ];
  const studentRoleIds = new Set<string>();

  if (attemptStudentIds.length > 0) {
    const { data: roleRows, error: rolesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", attemptStudentIds)
      .eq("role", "student");

    if (rolesError) {
      console.error(
        "[getRecentActivity] attempt profile roles",
        rolesError.message,
      );
    } else {
      for (const row of roleRows ?? []) {
        studentRoleIds.add(row.id);
      }
    }
  }

  const rawEvents: RawActivityEvent[] = [];

  for (const row of enrollmentRows ?? []) {
    const cohortName =
      (row.cohorts as { name?: string } | null)?.name?.trim() || "группа";
    rawEvents.push({
      id: `enrollment-${row.id}`,
      type: "enrollment",
      title: cohortName,
      description: `присоединился к группе ${cohortName}`,
      date: row.enrolled_at,
      studentId: row.user_id,
    });
  }

  for (const row of attemptRows ?? []) {
    if (!studentRoleIds.has(row.student_id)) {
      continue;
    }

    const testsRel = row.tests as
      | { title?: string | null }
      | { title?: string | null }[]
      | null;
    const testTitle = Array.isArray(testsRel)
      ? testsRel[0]?.title
      : testsRel?.title;
    const lessonTitle = testTitle?.trim() || "тест";

    if (!row.completed_at) {
      continue;
    }

    rawEvents.push({
      id: `test-${row.id}`,
      type: "test",
      title: lessonTitle,
      description: `сдал тест «${lessonTitle}»`,
      date: row.completed_at,
      studentId: row.student_id,
    });
  }

  for (const row of submissionRows ?? []) {
    const lessonTitle =
      assignmentTitlesByBlockId.get(row.lesson_block_id) ?? "урок";

    rawEvents.push({
      id: `assignment-${row.id}`,
      type: "assignment",
      title: lessonTitle,
      description: `отправил задание «${lessonTitle}»`,
      date: row.created_at,
      studentId: row.student_id,
    });
  }

  rawEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return attachStudentNames(supabase, rawEvents.slice(0, fetchLimit));
}
