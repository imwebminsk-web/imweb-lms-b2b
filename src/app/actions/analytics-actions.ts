"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getStaffCourseGradebookMatrix,
  type MatrixGradebookData,
} from "@/app/actions/gradebook-actions";
import { getB2BUsers } from "./b2b-user-actions";
import type {
  CourseAnalyticsEmployeeRow,
  CourseProgressStatus,
  EmployeeAnalyticsRow,
  EmployeeTranscriptCourse,
  TranscriptJournalAssessment,
} from "@/types/analytics";
import { readBlockSaveToJournal } from "@/lib/gradebook/journal-utils";
import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import { normalizeStoredAssignmentPoints } from "@/lib/learn/assignment-grade-display";
import { clampScorePercent } from "@/lib/utils/grading";
import type { Json } from "@/types/database.types";

type TeamMembershipRow = {
  team_id: string;
  job_title_id: string | null;
  teams: { name: string } | { name: string }[] | null;
  job_titles: { name: string } | { name: string }[] | null;
};

type AnalyticsProfileRow = {
  id: string;
  full_name: string | null;
  team_members: TeamMembershipRow[] | TeamMembershipRow | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getPrimaryTeamMembership(
  profile: AnalyticsProfileRow,
): TeamMembershipRow | null {
  return unwrapRelation(profile.team_members);
}

function courseIdFromLessonModules(modules: unknown): string | null {
  const rel = unwrapRelation(
    modules as { course_id: string } | { course_id: string }[] | null,
  );
  return rel?.course_id ?? null;
}

/** Журнал в старых блоках мог писаться как saveToJournal — учитываем оба ключа. */
function blockSavesToJournal(content: Json): boolean {
  if (readBlockSaveToJournal(content)) return true;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  return (content as Record<string, unknown>).saveToJournal === true;
}

function plainTextFromHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function assignmentTitleFromBlock(content: Json, lessonTitle: string): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const rec = content as Record<string, unknown>;
    if (typeof rec.title === "string" && rec.title.trim()) {
      return rec.title.trim();
    }
    if (typeof rec.instructions === "string") {
      const plain = plainTextFromHtml(rec.instructions);
      if (plain) {
        return plain.length > 80 ? `${plain.slice(0, 80)}…` : plain;
      }
    }
  }
  return lessonTitle.trim() || "Задание";
}

type JournalLessonInput = {
  id: string;
  title: string | null;
  test_id: string | null;
  courseId: string;
};

type JournalAssessmentDef = {
  type: "test" | "assignment";
  title: string;
  courseId: string;
  testId: string | null;
  blockId: string | null;
};

type BestCompletedAttempt = {
  id: string;
  score: number | null;
};

type LatestSubmission = {
  status: string;
  grade: number | null;
};

type JournalAssessmentData = {
  defs: JournalAssessmentDef[];
  bestCompleted: Map<string, BestCompletedAttempt>;
  pendingAttemptId: Map<string, string>;
  latestSubmission: Map<string, LatestSubmission>;
};

function attemptKey(studentId: string, testId: string): string {
  return `${studentId}:${testId}`;
}

function submissionKey(studentId: string, blockId: string): string {
  return `${studentId}:${blockId}`;
}

/**
 * Собирает колонки журнала как getMatrixGradebookData:
 * тесты из lessons.test_id и блоков quiz, задания с save_to_journal,
 * лучший completed-балл, последняя сдача задания.
 */
async function loadJournalAssessmentData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIds: string[],
  lessons: JournalLessonInput[],
): Promise<JournalAssessmentData> {
  const empty: JournalAssessmentData = {
    defs: [],
    bestCompleted: new Map(),
    pendingAttemptId: new Map(),
    latestSubmission: new Map(),
  };

  if (lessons.length === 0) return empty;

  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: blockRows, error: blocksError } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id, order_index, type, content")
    .in("lesson_id", lessonIds)
    .in("type", ["quiz", "assignment"])
    .order("order_index", { ascending: true });

  if (blocksError) {
    console.error("[loadJournalAssessmentData] blocks", blocksError.message);
  }

  type BlockRow = {
    id: string;
    lesson_id: string;
    order_index: number;
    type: string;
    content: Json;
  };

  const blocksByLesson = new Map<string, BlockRow[]>();
  for (const block of (blockRows ?? []) as BlockRow[]) {
    const list = blocksByLesson.get(block.lesson_id) ?? [];
    list.push(block);
    blocksByLesson.set(block.lesson_id, list);
  }

  const columns: JournalAssessmentDef[] = [];
  const testIdSet = new Set<string>();

  for (const lesson of lessons) {
    const lessonTitle = lesson.title?.trim() || "Урок";
    const seenTests = new Set<string>();

    if (lesson.test_id) {
      seenTests.add(lesson.test_id);
      testIdSet.add(lesson.test_id);
      columns.push({
        type: "test",
        title: "Тест",
        courseId: lesson.courseId,
        testId: lesson.test_id,
        blockId: null,
      });
    }

    for (const block of blocksByLesson.get(lesson.id) ?? []) {
      if (block.type === "quiz") {
        const testId = parseTestIdFromQuizBlockContent(block.content);
        if (!testId || seenTests.has(testId)) continue;
        seenTests.add(testId);
        testIdSet.add(testId);
        columns.push({
          type: "test",
          title: "Тест",
          courseId: lesson.courseId,
          testId,
          blockId: block.id,
        });
      } else if (block.type === "assignment") {
        if (!blockSavesToJournal(block.content)) continue;
        columns.push({
          type: "assignment",
          title: assignmentTitleFromBlock(block.content, lessonTitle),
          courseId: lesson.courseId,
          testId: null,
          blockId: block.id,
        });
      }
    }
  }

  const testMetaById = new Map<
    string,
    { title: string; save_to_journal: boolean; is_published: boolean | null }
  >();
  const collectedTestIds = [...testIdSet];
  if (collectedTestIds.length > 0) {
    const { data: testMetaRows, error: testMetaError } = await supabase
      .from("tests")
      .select("id, title, save_to_journal, is_published")
      .in("id", collectedTestIds);

    if (testMetaError) {
      console.error("[loadJournalAssessmentData] tests", testMetaError.message);
    }

    for (const row of testMetaRows ?? []) {
      testMetaById.set(row.id, {
        title: row.title,
        save_to_journal: row.save_to_journal,
        is_published: row.is_published,
      });
    }
  }

  const defs = columns
    .filter((col) => {
      if (col.type !== "test" || !col.testId) return true;
      const meta = testMetaById.get(col.testId);
      if (!meta) return false;
      if (meta.is_published !== true) return false;
      return meta.save_to_journal;
    })
    .map((col) => {
      if (col.type !== "test" || !col.testId) return col;
      const meta = testMetaById.get(col.testId);
      return {
        ...col,
        title: meta?.title?.trim() || "Тест",
      };
    });

  const bestCompleted = new Map<string, BestCompletedAttempt>();
  const pendingAttemptId = new Map<string, string>();
  const latestSubmission = new Map<string, LatestSubmission>();

  if (studentIds.length === 0) {
    return { defs, bestCompleted, pendingAttemptId, latestSubmission };
  }

  const testIds = [
    ...new Set(
      defs
        .map((def) => def.testId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (testIds.length > 0) {
    const { data: attemptRows, error: attemptsError } = await supabase
      .from("student_attempts")
      .select("id, student_id, test_id, score, status")
      .in("student_id", studentIds)
      .in("test_id", testIds);

    if (attemptsError) {
      console.error("[loadJournalAssessmentData] attempts", attemptsError.message);
    }

    for (const attempt of attemptRows ?? []) {
      const key = attemptKey(attempt.student_id, attempt.test_id);
      if (attempt.status === "completed") {
        const points = clampScorePercent(attempt.score);
        const prev = bestCompleted.get(key);
        if (!prev || points > clampScorePercent(prev.score)) {
          bestCompleted.set(key, { id: attempt.id, score: attempt.score });
        }
      } else if (attempt.status === "pending_review") {
        pendingAttemptId.set(key, attempt.id);
      }
    }
  }

  const uniqueBlockIds = [
    ...new Set(
      defs
        .filter((def) => def.type === "assignment" && def.blockId)
        .map((def) => def.blockId as string),
    ),
  ];

  if (uniqueBlockIds.length > 0) {
    const { data: subRows, error: subError } = await supabase
      .from("assignment_submissions")
      .select("id, student_id, lesson_block_id, status, grade, updated_at")
      .in("student_id", studentIds)
      .in("lesson_block_id", uniqueBlockIds);

    if (subError) {
      console.error("[loadJournalAssessmentData] submissions", subError.message);
    }

    const latestByKey = new Map<string, { updatedAt: number; row: LatestSubmission }>();
    for (const sub of subRows ?? []) {
      const key = submissionKey(sub.student_id, sub.lesson_block_id);
      const updatedAt = new Date(sub.updated_at).getTime();
      const prev = latestByKey.get(key);
      if (!prev || updatedAt > prev.updatedAt) {
        latestByKey.set(key, {
          updatedAt,
          row: { status: sub.status, grade: sub.grade },
        });
      }
    }
    for (const [key, value] of latestByKey) {
      latestSubmission.set(key, value.row);
    }
  }

  return { defs, bestCompleted, pendingAttemptId, latestSubmission };
}

function toTranscriptAssessment(
  def: JournalAssessmentDef,
  studentId: string,
  data: JournalAssessmentData,
): TranscriptJournalAssessment {
  if (def.type === "test" && def.testId) {
    const key = attemptKey(studentId, def.testId);
    const pendingId = data.pendingAttemptId.get(key);
    const best = data.bestCompleted.get(key);

    if (pendingId) {
      return {
        type: "test",
        title: def.title,
        score: null,
        isPendingReview: true,
        testId: def.testId,
        attemptId: pendingId,
        blockId: def.blockId,
        assignmentStatus: null,
      };
    }

    return {
      type: "test",
      title: def.title,
      score: best ? clampScorePercent(best.score) : null,
      isPendingReview: false,
      testId: def.testId,
      attemptId: best?.id ?? null,
      blockId: def.blockId,
      assignmentStatus: null,
    };
  }

  const sub = def.blockId
    ? data.latestSubmission.get(submissionKey(studentId, def.blockId))
    : undefined;
  const assignmentStatus =
    sub?.status === "pending" ||
    sub?.status === "approved" ||
    sub?.status === "rejected"
      ? sub.status
      : null;

  return {
    type: "assignment",
    title: def.title,
    score:
      assignmentStatus === "approved"
        ? normalizeStoredAssignmentPoints(sub?.grade ?? null)
        : null,
    isPendingReview: assignmentStatus === "pending",
    testId: null,
    attemptId: null,
    blockId: def.blockId,
    assignmentStatus,
  };
}

export async function getAnalyticsFilters() {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("status", "published")
    .order("title", { ascending: true });

  const { data: tags } = await supabase
    .from("taxonomies")
    .select("id, label")
    .order("label", { ascending: true });

  return {
    teams: teams ?? [],
    courses: courses ?? [],
    tags: tags ?? [],
  };
}

export async function getEmployeeAnalytics(filters: {
  q?: string;
  team?: string;
  course?: string;
  tag?: string;
  page?: number;
}): Promise<{ success: true; data: EmployeeAnalyticsRow[] } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему." };
  }

  // Check admin or head_teacher
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "head_teacher") {
    return { success: false, error: "Нет доступа." };
  }

  // Same root query shape as getB2BUsers — profiles + team_members → teams/job_titles
  const b2bResponse = await getB2BUsers();
  if (!b2bResponse.success || !("data" in b2bResponse)) {
    return { success: false, error: ("error" in b2bResponse ? b2bResponse.error : null) || "Ошибка загрузки пользователей." };
  }

  let profilesDataRaw = b2bResponse.data;

  if (filters.q) {
    const qLower = filters.q.toLowerCase();
    profilesDataRaw = profilesDataRaw.filter((p: any) =>
      p.full_name?.toLowerCase().includes(qLower)
    );
  }

  if (filters.tag && filters.tag !== "all") {
    profilesDataRaw = profilesDataRaw.filter((p: any) => {
      if (!p.user_taxonomies || !Array.isArray(p.user_taxonomies)) return false;
      return p.user_taxonomies.some((ut: any) => 
        ut.taxonomies?.id === filters.tag || ut.taxonomy_id === filters.tag
      );
    });
  }

  const profilesData = (profilesDataRaw ?? []) as AnalyticsProfileRow[];

  let filteredProfiles = profilesData;
  if (filters.team && filters.team !== "all") {
    filteredProfiles = filteredProfiles.filter((profile) => {
      const memberships = Array.isArray(profile.team_members)
        ? profile.team_members
        : profile.team_members
          ? [profile.team_members]
          : [];
      return memberships.some((m) => m.team_id === filters.team);
    });
  }

  // Fetch courses assigned to users
  // A user is assigned a course if:
  // 1. The course is global (is_global = true)
  // 2. The course is assigned to their team (team_courses)
  // 3. The course is assigned to their job title (job_title_courses)
  
  const { data: allCourses } = await (supabase as any)
    .from("courses")
    .select("id, status, is_global")
    .eq("status", "published");

  const { data: teamCourses } = await supabase.from("team_courses").select("team_id, course_id");
  const { data: jobTitleCourses } = await supabase.from("job_title_courses").select("job_title_id, course_id");

  // Build a map of user_id -> assigned course_ids
  const assignedCoursesByUser = new Map<string, Set<string>>();
  
  for (const p of filteredProfiles) {
    const assigned = new Set<string>();
    const tm = getPrimaryTeamMembership(p);
    if (!tm) continue;

    for (const c of allCourses ?? []) {
      if (c.is_global) {
        assigned.add(c.id);
      }
    }

    for (const tc of teamCourses ?? []) {
      if (tc.team_id === tm.team_id) {
        assigned.add(tc.course_id);
      }
    }

    for (const jtc of jobTitleCourses ?? []) {
      if (jtc.job_title_id === tm.job_title_id) {
        assigned.add(jtc.course_id);
      }
    }

    assignedCoursesByUser.set(p.id, assigned);
  }

  // Filter by course if provided
  if (filters.course && filters.course !== "all") {
    filteredProfiles = filteredProfiles.filter((p) => {
      const assigned = assignedCoursesByUser.get(p.id);
      return assigned?.has(filters.course!);
    });
  }

  const filteredUserIds = filteredProfiles.map((p) => p.id);
  if (filteredUserIds.length === 0) {
    return { success: true, data: [] };
  }

  // Fetch completions
  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("student_id, lesson_id")
    .in("student_id", filteredUserIds);

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, modules!inner(course_id)")
    .eq("is_published", true);

  const lessonCourseMap = new Map<string, string>();
  const totalLessonsByCourse = new Map<string, number>();
  for (const l of lessons ?? []) {
    const courseId = (l.modules as any)?.course_id;
    if (courseId) {
      lessonCourseMap.set(l.id, courseId);
      totalLessonsByCourse.set(courseId, (totalLessonsByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const completedLessonsByUserCourse = new Map<string, number>();
  for (const c of completions ?? []) {
    const courseId = lessonCourseMap.get(c.lesson_id);
    if (courseId) {
      const key = `${c.student_id}:${courseId}`;
      completedLessonsByUserCourse.set(key, (completedLessonsByUserCourse.get(key) ?? 0) + 1);
    }
  }

  // Fetch final assessments for the selected course (same rules as B2C gradebook)
  let journalData: JournalAssessmentData = {
    defs: [],
    bestCompleted: new Map(),
    pendingAttemptId: new Map(),
    latestSubmission: new Map(),
  };

  if (filters.course && filters.course !== "all") {
    const { data: courseLessons } = await supabase
      .from("lessons")
      .select("id, title, test_id, modules!inner(course_id)")
      .eq("modules.course_id", filters.course)
      .eq("is_published", true);

    const journalLessons: JournalLessonInput[] = [];
    for (const lesson of courseLessons ?? []) {
      const courseId = courseIdFromLessonModules(lesson.modules) ?? filters.course;
      journalLessons.push({
        id: lesson.id,
        title: lesson.title,
        test_id: lesson.test_id,
        courseId,
      });
    }

    journalData = await loadJournalAssessmentData(
      supabase,
      filteredUserIds,
      journalLessons,
    );
  }

  const rows: EmployeeAnalyticsRow[] = filteredProfiles.map((p) => {
    const tm = getPrimaryTeamMembership(p);
    const teamName = unwrapRelation(tm?.teams)?.name ?? "-";
    const jobTitleName = unwrapRelation(tm?.job_titles)?.name ?? "-";

    const assigned = assignedCoursesByUser.get(p.id) ?? new Set();
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let sumProgress = 0;
    let courseStatus: 'completed' | 'in_progress' | 'not_started' | null = null;
    let journalAssessments: { title: string; score: number | null; isPendingReview: boolean }[] = [];

    if (filters.course && filters.course !== "all") {
      const courseId = filters.course;
      const totalL = totalLessonsByCourse.get(courseId) ?? 0;
      const compL = completedLessonsByUserCourse.get(`${p.id}:${courseId}`) ?? 0;
      
      if (totalL > 0) {
        sumProgress = Math.round((compL / totalL) * 100);
        if (compL === totalL) {
          courseStatus = "completed";
        } else if (compL > 0) {
          courseStatus = "in_progress";
        } else {
          courseStatus = "not_started";
        }
      } else {
        courseStatus = "not_started";
      }

      for (const def of journalData.defs) {
        const assessment = toTranscriptAssessment(def, p.id, journalData);
        journalAssessments.push({
          title: assessment.title,
          score: assessment.score,
          isPendingReview: assessment.isPendingReview,
        });
      }
    } else {
      for (const courseId of assigned) {
        total++;
        const totalL = totalLessonsByCourse.get(courseId) ?? 0;
        const compL = completedLessonsByUserCourse.get(`${p.id}:${courseId}`) ?? 0;
        if (totalL > 0) {
          sumProgress += (compL / totalL) * 100;
          if (compL === totalL) {
            completed++;
          } else if (compL > 0) {
            inProgress++;
          } else {
            notStarted++;
          }
        } else {
          notStarted++;
        }
      }
    }

    const avgProgress = total > 0 ? Math.round(sumProgress / total) : sumProgress;
    
    let avgScore = 0;
    if (journalAssessments.length > 0) {
      let sum = 0;
      let count = 0;
      for (const a of journalAssessments) {
        if (a.score !== null) {
          sum += a.score;
          count++;
        }
      }
      avgScore = count > 0 ? Math.round(sum / count) : 0;
    }

    return {
      id: p.id,
      fullName: p.full_name ?? "Без имени",
      team: teamName,
      jobTitle: jobTitleName,
      total,
      completed,
      inProgress,
      notStarted,
      courseStatus,
      journalAssessments,
      assignedCourses: total,
      avgProgress: filters.course && filters.course !== "all" ? sumProgress : avgProgress,
      avgScore,
    };
  });

  return { success: true, data: rows };
}

export async function getEmployeeTranscript(userId: string): Promise<{ success: true; data: EmployeeTranscriptCourse[] } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "head_teacher") {
    return { success: false, error: "Нет доступа." };
  }

  // 1. Get user's team and job title
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, job_title_id")
    .eq("user_id", userId);

  const tm = teamMembers?.[0];

  // 2. Get all assigned courses
  const { data: allCourses } = await (supabase as any)
    .from("courses")
    .select("id, title, status, is_global")
    .eq("status", "published");

  const { data: teamCourses } = await supabase.from("team_courses").select("team_id, course_id");
  const { data: jobTitleCourses } = await supabase.from("job_title_courses").select("job_title_id, course_id");

  const assignedCourses = new Map<string, { id: string; title: string }>();

  for (const c of allCourses ?? []) {
    let isAssigned = false;
    if (c.is_global) {
      isAssigned = true;
    } else if (tm) {
      if (teamCourses?.some(tc => tc.team_id === tm.team_id && tc.course_id === c.id)) {
        isAssigned = true;
      } else if (jobTitleCourses?.some(jtc => jtc.job_title_id === tm.job_title_id && jtc.course_id === c.id)) {
        isAssigned = true;
      }
    }
    if (isAssigned) {
      assignedCourses.set(c.id, { id: c.id, title: c.title });
    }
  }

  if (assignedCourses.size === 0) {
    return { success: true, data: [] };
  }

  const assignedCourseIds = Array.from(assignedCourses.keys());

  // 3. Fetch completions
  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("student_id", userId);

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, test_id, modules!inner(course_id)")
    .in("modules.course_id", assignedCourseIds)
    .eq("is_published", true);

  const lessonCourseMap = new Map<string, string>();
  const totalLessonsByCourse = new Map<string, number>();
  const journalLessons: JournalLessonInput[] = [];
  for (const l of lessons ?? []) {
    const courseId = (l.modules as any)?.course_id;
    if (courseId) {
      lessonCourseMap.set(l.id, courseId);
      totalLessonsByCourse.set(courseId, (totalLessonsByCourse.get(courseId) ?? 0) + 1);
      journalLessons.push({
        id: l.id,
        title: l.title,
        test_id: l.test_id,
        courseId,
      });
    }
  }

  const completedLessonsByCourse = new Map<string, number>();
  for (const c of completions ?? []) {
    const courseId = lessonCourseMap.get(c.lesson_id);
    if (courseId) {
      completedLessonsByCourse.set(courseId, (completedLessonsByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const journalData = await loadJournalAssessmentData(
    supabase,
    [userId],
    journalLessons,
  );

  const result: EmployeeTranscriptCourse[] = [];

  for (const [courseId, courseData] of assignedCourses.entries()) {
    const totalL = totalLessonsByCourse.get(courseId) ?? 0;
    const compL = completedLessonsByCourse.get(courseId) ?? 0;
    
    let progress = 0;
    let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';

    if (totalL > 0) {
      progress = Math.round((compL / totalL) * 100);
      if (compL === totalL) {
        status = "completed";
      } else if (compL > 0) {
        status = "in_progress";
      }
    }

    const journalAssessments = journalData.defs
      .filter((def) => def.courseId === courseId)
      .map((def) => toTranscriptAssessment(def, userId, journalData));

    result.push({
      courseId,
      courseTitle: courseData.title,
      status,
      progress,
      journalAssessments,
    });
  }

  return { success: true, data: result };
}

const courseIdSchema = z.string().uuid("Некорректный ID курса");

function courseProgressFromCounts(
  completedLessons: number,
  totalLessons: number,
): { progress: number; courseStatus: CourseProgressStatus } {
  if (totalLessons <= 0) {
    return { progress: 0, courseStatus: "not_started" };
  }

  const progress = Math.round((completedLessons / totalLessons) * 100);
  if (completedLessons >= totalLessons) {
    return { progress, courseStatus: "completed" };
  }
  if (completedLessons > 0) {
    return { progress, courseStatus: "in_progress" };
  }
  return { progress: 0, courseStatus: "not_started" };
}

/**
 * Сотрудники, назначенные на курс (глобально / отдел / должность / enrollments),
 * и их прогресс только по lesson_completions.
 */
export async function getB2BCourseAnalytics(
  courseId: string,
): Promise<
  | {
      success: true;
      data: {
        matrix: MatrixGradebookData;
        employees: CourseAnalyticsEmployeeRow[];
      };
    }
  | { success: false; error: string }
> {
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID курса",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "head_teacher") {
    return { success: false, error: "Нет доступа." };
  }

  // is_global ещё нет в generated Database types.
  const { data: course, error: courseError } = await (supabase as any)
    .from("courses")
    .select("id, status, is_global")
    .eq("id", parsed.data)
    .maybeSingle();

  if (courseError || !course) {
    return { success: false, error: "Курс не найден." };
  }

  const [{ data: teamCourses }, { data: jobTitleCourses }, { data: enrollments }] =
    await Promise.all([
      supabase.from("team_courses").select("team_id").eq("course_id", parsed.data),
      supabase
        .from("job_title_courses")
        .select("job_title_id")
        .eq("course_id", parsed.data),
      supabase.from("enrollments").select("user_id").eq("course_id", parsed.data),
    ]);

  const assignedUserIds = new Set<string>();
  for (const row of enrollments ?? []) {
    assignedUserIds.add(row.user_id);
  }

  const teamIds = (teamCourses ?? []).map((row) => row.team_id);
  const jobTitleIds = (jobTitleCourses ?? [])
    .map((row) => row.job_title_id)
    .filter((id): id is string => Boolean(id));

  const courseIsGlobal = Boolean(
    (course as { is_global?: boolean | null }).is_global,
  );

  if (courseIsGlobal) {
    const { data: allMembers } = await supabase
      .from("team_members")
      .select("user_id");
    for (const member of allMembers ?? []) {
      assignedUserIds.add(member.user_id);
    }
  } else {
    if (teamIds.length > 0) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds);
      for (const member of teamMembers ?? []) {
        assignedUserIds.add(member.user_id);
      }
    }
    if (jobTitleIds.length > 0) {
      const { data: jobMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .in("job_title_id", jobTitleIds);
      for (const member of jobMembers ?? []) {
        assignedUserIds.add(member.user_id);
      }
    }
  }

  const userIds = [...assignedUserIds];
  if (userIds.length === 0) {
    return { success: true, data: [] };
  }

  const [{ data: profiles }, { data: memberships }, { data: lessons }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      supabase
        .from("team_members")
        .select("user_id, team_id, job_title_id")
        .in("user_id", userIds),
      supabase
        .from("lessons")
        .select("id, modules!inner(course_id)")
        .eq("modules.course_id", parsed.data)
        .eq("is_published", true),
    ]);

  const teamNameById = new Map<string, string>();
  const jobNameById = new Map<string, string>();
  const uniqueTeamIds = [
    ...new Set((memberships ?? []).map((row) => row.team_id)),
  ];
  const uniqueJobIds = [
    ...new Set(
      (memberships ?? [])
        .map((row) => row.job_title_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [teamsRes, jobsRes] = await Promise.all([
    uniqueTeamIds.length > 0
      ? supabase.from("teams").select("id, name").in("id", uniqueTeamIds)
      : Promise.resolve({ data: [] }),
    uniqueJobIds.length > 0
      ? supabase.from("job_titles").select("id, name").in("id", uniqueJobIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const team of teamsRes.data ?? []) {
    teamNameById.set(team.id, team.name);
  }
  for (const job of jobsRes.data ?? []) {
    jobNameById.set(job.id, job.name);
  }

  const membershipByUser = new Map<
    string,
    { team_id: string; job_title_id: string | null }
  >();
  for (const row of memberships ?? []) {
    if (!membershipByUser.has(row.user_id)) {
      membershipByUser.set(row.user_id, {
        team_id: row.team_id,
        job_title_id: row.job_title_id,
      });
    }
  }

  const publishedLessonIds = new Set((lessons ?? []).map((lesson) => lesson.id));
  const totalLessons = publishedLessonIds.size;

  const completedLessonsByUser = new Map<string, Set<string>>();
  if (userIds.length > 0 && publishedLessonIds.size > 0) {
    const { data: completions } = await supabase
      .from("lesson_completions")
      .select("student_id, lesson_id")
      .in("student_id", userIds)
      .in("lesson_id", [...publishedLessonIds]);

    for (const row of completions ?? []) {
      if (!publishedLessonIds.has(row.lesson_id)) continue;
      const set = completedLessonsByUser.get(row.student_id) ?? new Set<string>();
      set.add(row.lesson_id);
      completedLessonsByUser.set(row.student_id, set);
    }
  }

  const profileById = new Map(
    (profiles ?? []).map((row) => [row.id, row] as const),
  );

  const data: CourseAnalyticsEmployeeRow[] = userIds
    .map((userId) => {
      const person = profileById.get(userId);
      const membership = membershipByUser.get(userId);
      const completedCount = completedLessonsByUser.get(userId)?.size ?? 0;
      const { progress, courseStatus } = courseProgressFromCounts(
        completedCount,
        totalLessons,
      );

      return {
        id: userId,
        fullName: person?.full_name?.trim() || "Без имени",
        team: membership ? (teamNameById.get(membership.team_id) ?? "-") : "-",
        jobTitle: membership?.job_title_id
          ? (jobNameById.get(membership.job_title_id) ?? "-")
          : "-",
        courseStatus,
        progress,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  const students = data.map((row) => {
    const person = profileById.get(row.id);
    return {
      id: row.id,
      name: row.fullName,
      email: "—",
      avatarUrl: person?.avatar_url ?? null,
    };
  });

  const matrixRes = await getStaffCourseGradebookMatrix(parsed.data, students);

  if (!matrixRes.success) {
    return matrixRes;
  }

  return {
    success: true,
    data: {
      matrix: matrixRes.data,
      employees: data,
    },
  };
}
