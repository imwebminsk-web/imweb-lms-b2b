"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";

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

type Json = Database["public"]["Tables"]["lesson_blocks"]["Row"]["content"];

function parseTestIdFromQuizBlockContent(content: Json): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const testId = (content as Record<string, unknown>).test_id;
  return typeof testId === "string" && testId.length > 0 ? testId : null;
}

async function buildTeacherTestLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();

  const { data: lessonRows, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title, test_id, modules!inner(courses!inner(teacher_id))")
    .eq("modules.courses.teacher_id", teacherId)
    .not("test_id", "is", null);

  if (lessonsError) {
    console.error("[getRecentActivity] lessons", lessonsError.message);
  }

  const lessonIds: string[] = [];

  for (const lesson of lessonRows ?? []) {
    lessonIds.push(lesson.id);
    const lessonTitle = lesson.title?.trim() || "Урок";
    if (lesson.test_id) {
      labels.set(lesson.test_id, lessonTitle);
    }
  }

  if (lessonIds.length > 0) {
    const { data: blockRows, error: blocksError } = await supabase
      .from("lesson_blocks")
      .select("content, lessons!inner(id, title)")
      .in("lesson_id", lessonIds)
      .eq("type", "quiz");

    if (blocksError) {
      console.error("[getRecentActivity] quiz blocks", blocksError.message);
    }

    for (const block of blockRows ?? []) {
      const lessonRel = block.lessons as { id: string; title: string } | null;
      const lessonTitle = lessonRel?.title?.trim() || "Урок";
      const testId = parseTestIdFromQuizBlockContent(block.content);
      if (testId) {
        labels.set(testId, lessonTitle);
      }
    }
  }

  return labels;
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

  const testLabels = await buildTeacherTestLabels(supabase, tid);
  const testIds = [...testLabels.keys()];

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
      .limit(limit),
    testIds.length > 0
      ? supabase
          .from("student_attempts")
          .select("id, completed_at, student_id, test_id, tests(title)")
          .in("test_id", testIds)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    supabase
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
              courses!inner(teacher_id)
            )
          )
        )
      `,
      )
      .eq("lesson_blocks.lessons.modules.courses.teacher_id", tid)
      .order("created_at", { ascending: false })
      .limit(limit),
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
    const testsRel = row.tests as { title?: string } | { title?: string }[] | null;
    const testTitle = Array.isArray(testsRel)
      ? testsRel[0]?.title
      : testsRel?.title;
    const lessonTitle =
      (row.test_id ? testLabels.get(row.test_id) : null) ??
      testTitle?.trim() ??
      "тест";

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
      (
        row as {
          lesson_blocks?: { lessons?: { title?: string } | null } | null;
        }
      ).lesson_blocks?.lessons?.title?.trim() || "урок";

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

  return attachStudentNames(supabase, rawEvents.slice(0, limit));
}
