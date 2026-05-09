import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CohortAssignmentManager } from "@/components/dashboard/teacher/cohorts/cohort-assignment-manager";
import {
  CohortGradebookTable,
  type GradebookAssignmentCell,
  type GradebookCell,
} from "@/components/dashboard/teacher/cohorts/cohort-gradebook-table";
import { CohortStatusToggle } from "@/components/dashboard/teacher/cohorts/cohort-status-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

type CohortPageProps = {
  params: Promise<{ id: string }>;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  enrolled_at: string;
};

type CohortStudentEmailRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
};

type LessonWithTestRow = {
  id: string;
  title: string;
  order_index: number;
  module_id: string;
  test_id: string | null;
  tests: { id: string; title: string } | { id: string; title: string }[] | null;
  modules:
    | { id: string; title: string; order_index: number; course_id: string }
    | { id: string; title: string; order_index: number; course_id: string }[]
    | null;
};

type AttemptRow = {
  student_id: string;
  test_id: string;
  score: number | null;
};

type CohortAssignmentRow = {
  lesson_id: string | null;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

const PASS_PERCENT = 60;

function snippetFromAssignmentInstructions(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const instr = (content as Record<string, unknown>).instructions;
  return typeof instr === "string" ? instr.trim() : "";
}

function assignmentColumnTitle(lessonTitle: string, content: Json): string {
  const full = snippetFromAssignmentInstructions(content);
  if (full) {
    const clipped = full.slice(0, 48);
    return `${lessonTitle}: ${clipped}${full.length > 48 ? "…" : ""}`;
  }
  return `${lessonTitle} · Задание`;
}

export default async function CohortDetailsPage({ params }: CohortPageProps) {
  const { id } = await params;
  const cohortId = id?.trim();

  if (!cohortId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, pin_code, is_active, created_at, course_id, courses(id, title, teacher_id)")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError || !cohort) {
    notFound();
  }

  const courseRel = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
  if (!courseRel) {
    notFound();
  }

  // Safety check: only the course owner can access this page.
  if (courseRel.teacher_id !== user.id) {
    redirect("/dashboard/cohorts");
  }

  const [{ data: enrollmentsData, error: enrollmentsError }, { data: emailRowsRaw, error: emailsError }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, user_id, enrolled_at")
        .eq("cohort_id", cohort.id)
        .order("enrolled_at", { ascending: false }),
      supabase.rpc("get_cohort_student_emails", { p_cohort_id: cohort.id }),
    ]);

  if (enrollmentsError) {
    console.error("[CohortDetailsPage] enrollments", enrollmentsError.message);
  }
  if (emailsError) {
    console.error("[CohortDetailsPage] emails", emailsError.message);
  }

  const enrollments = (enrollmentsData ?? []) as EnrollmentRow[];
  const emailRows = (emailRowsRaw ?? []) as CohortStudentEmailRow[];
  const studentMetaByUserId = new Map<
    string,
    { email: string; full_name: string | null }
  >();
  for (const row of emailRows) {
    studentMetaByUserId.set(row.user_id, {
      email: row.email ?? "—",
      full_name: row.full_name,
    });
  }

  const studentIds = enrollments.map((row) => row.user_id);

  const { data: lessonsRaw, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      "id, title, order_index, module_id, test_id, tests(id, title), modules!inner(id, title, order_index, course_id)",
    )
    .eq("modules.course_id", cohort.course_id)
    .order("order_index", { ascending: true });

  if (lessonsError) {
    console.error("[CohortDetailsPage] lessons", lessonsError.message);
  }

  const lessons = (lessonsRaw ?? []) as LessonWithTestRow[];
  const { data: assignmentRowsRaw, error: assignmentsError } = await supabase
    .from("cohort_assignments")
    .select("lesson_id")
    .eq("cohort_id", cohort.id);

  if (assignmentsError) {
    console.error("[CohortDetailsPage] cohort_assignments", assignmentsError.message);
  }

  const assignmentRows = (assignmentRowsRaw ?? []) as CohortAssignmentRow[];
  const assignedLessonIds = new Set(
    assignmentRows.map((r) => r.lesson_id).filter((v): v is string => Boolean(v)),
  );
  const hasAssignments = assignmentRows.length > 0;

  const moduleGroups = new Map<
    string,
    { id: string; title: string; position: number; lessons: { id: string; title: string; hasTest: boolean }[] }
  >();
  for (const lesson of lessons) {
    const moduleRel = Array.isArray(lesson.modules) ? lesson.modules[0] : lesson.modules;
    if (!moduleRel) continue;

    if (!moduleGroups.has(moduleRel.id)) {
      moduleGroups.set(moduleRel.id, {
        id: moduleRel.id,
        title: moduleRel.title,
        position: moduleRel.order_index,
        lessons: [],
      });
    }
    moduleGroups.get(moduleRel.id)!.lessons.push({
      id: lesson.id,
      title: lesson.title,
      hasTest: lesson.test_id != null,
    });
  }
  const lessonsForManager = [...moduleGroups.values()]
    .map((m) => ({
      ...m,
      lessons: [...m.lessons].sort((a, b) => a.title.localeCompare(b.title, "ru")),
    }))
    .sort((a, b) => a.position - b.position);
  const seenTestIds = new Set<string>();
  const testsForGradebook: { id: string; title: string }[] = [];
  for (const lesson of lessons) {
    const testRel = Array.isArray(lesson.tests) ? lesson.tests[0] : lesson.tests;
    if (!testRel) continue;
    if (hasAssignments && !assignedLessonIds.has(lesson.id)) {
      continue;
    }
    if (seenTestIds.has(testRel.id)) continue;
    seenTestIds.add(testRel.id);
    testsForGradebook.push({ id: testRel.id, title: testRel.title });
  }
  const testIds = testsForGradebook.map((t) => t.id);

  const lessonIdsForGradebookContent = lessons
    .filter((l) => !hasAssignments || assignedLessonIds.has(l.id))
    .map((l) => l.id);

  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const { data: assignmentBlockRowsRaw, error: assignmentBlocksError } =
    lessonIdsForGradebookContent.length > 0
      ? await supabase
          .from("lesson_blocks")
          .select("id, content, order_index, lesson_id")
          .in("lesson_id", lessonIdsForGradebookContent)
          .eq("type", "assignment")
          .order("order_index", { ascending: true })
      : { data: [], error: null };

  if (assignmentBlocksError) {
    console.error(
      "[CohortDetailsPage] lesson_blocks assignment",
      assignmentBlocksError.message,
    );
  }

  type AssignmentBlockRow = {
    id: string;
    content: Json;
    order_index: number;
    lesson_id: string;
  };

  const assignmentBlockRows = (assignmentBlockRowsRaw ??
    []) as AssignmentBlockRow[];

  const assignmentsForGradebook = [...assignmentBlockRows]
    .sort((a, b) => {
      const la = lessonById.get(a.lesson_id);
      const lb = lessonById.get(b.lesson_id);
      const oa = la?.order_index ?? 0;
      const ob = lb?.order_index ?? 0;
      if (oa !== ob) return oa - ob;
      if (a.lesson_id !== b.lesson_id) {
        return String(a.lesson_id).localeCompare(String(b.lesson_id), "ru");
      }
      return a.order_index - b.order_index;
    })
    .map((block) => {
      const lesson = lessonById.get(block.lesson_id);
      const lessonTitle = lesson?.title?.trim() || "Урок";
      return {
        id: block.id,
        title: assignmentColumnTitle(lessonTitle, block.content as Json),
      };
    });

  const assignmentBlockIds = assignmentsForGradebook.map((b) => b.id);

  const submissionsPromise =
    studentIds.length > 0 && assignmentBlockIds.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("id, student_id, lesson_block_id, status, grade, updated_at")
          .in("student_id", studentIds)
          .in("lesson_block_id", assignmentBlockIds)
      : Promise.resolve({ data: [], error: null });

  const { data: submissionRowsRaw, error: submissionsError } =
    await submissionsPromise;

  if (submissionsError) {
    console.error(
      "[CohortDetailsPage] assignment_submissions",
      submissionsError.message,
    );
  }

  type SubmissionRow = {
    id: string;
    student_id: string;
    lesson_block_id: string;
    status: "pending" | "approved" | "rejected";
    grade: number | null;
    updated_at: string;
  };

  const submissionRows = (submissionRowsRaw ?? []) as SubmissionRow[];

  const latestSubmissionByStudentBlock = new Map<string, SubmissionRow>();
  for (const s of submissionRows) {
    const key = `${s.student_id}:${s.lesson_block_id}`;
    const prev = latestSubmissionByStudentBlock.get(key);
    if (
      !prev ||
      new Date(s.updated_at).getTime() > new Date(prev.updated_at).getTime()
    ) {
      latestSubmissionByStudentBlock.set(key, s);
    }
  }

  const attemptsPromise =
    studentIds.length > 0 && testIds.length > 0
      ? supabase
          .from("student_attempts")
          .select("student_id, test_id, score")
          .in("student_id", studentIds)
          .in("test_id", testIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [], error: null });

  const questionCountPromise =
    testIds.length > 0
      ? supabase.from("questions").select("test_id").in("test_id", testIds)
      : Promise.resolve({ data: [], error: null });

  const [{ data: attemptsRaw, error: attemptsError }, { data: questionsRaw, error: questionsError }] =
    await Promise.all([attemptsPromise, questionCountPromise]);

  if (attemptsError) {
    console.error("[CohortDetailsPage] attempts", attemptsError.message);
  }
  if (questionsError) {
    console.error("[CohortDetailsPage] questions", questionsError.message);
  }

  const attempts = (attemptsRaw ?? []) as AttemptRow[];
  const questions = questionsRaw ?? [];

  const questionCountByTest = new Map<string, number>();
  for (const q of questions) {
    const prev = questionCountByTest.get(q.test_id) ?? 0;
    questionCountByTest.set(q.test_id, prev + 1);
  }

  const bestPercentByStudentTest = new Map<string, number>();
  for (const a of attempts) {
    const total = questionCountByTest.get(a.test_id) ?? 0;
    if (total <= 0) continue;
    const rawScore = a.score ?? 0;
    const percent = Math.max(0, Math.min(100, Math.round((rawScore / total) * 100)));
    const key = `${a.student_id}:${a.test_id}`;
    const prev = bestPercentByStudentTest.get(key);
    if (prev == null || percent > prev) {
      bestPercentByStudentTest.set(key, percent);
    }
  }

  const gradebookRows = enrollments.map((row) => {
    const meta = studentMetaByUserId.get(row.user_id);
    const studentName = meta?.full_name?.trim() || row.user_id;
    const studentEmail = meta?.email ?? "—";
    const grades: Record<string, GradebookCell> = {};
    const assignmentCells: Record<string, GradebookAssignmentCell> = {};

    for (const test of testsForGradebook) {
      const best = bestPercentByStudentTest.get(`${row.user_id}:${test.id}`);
      if (best == null) {
        grades[test.id] = { percent: null, status: "not_started" };
      } else {
        grades[test.id] = {
          percent: best,
          status: best >= PASS_PERCENT ? "passed" : "failed",
        };
      }
    }

    for (const col of assignmentsForGradebook) {
      const sub = latestSubmissionByStudentBlock.get(
        `${row.user_id}:${col.id}`,
      );
      if (!sub) {
        assignmentCells[col.id] = {
          status: "not_started",
          grade: null,
          submissionId: null,
        };
      } else {
        assignmentCells[col.id] = {
          status: sub.status,
          grade: sub.grade,
          submissionId: sub.id,
        };
      }
    }

    return {
      userId: row.user_id,
      name: studentName,
      email: studentEmail,
      grades,
      assignmentCells,
    };
  });

  const gradebookRowsWithAverage = gradebookRows
    .map((row) => {
      const finished = testsForGradebook
        .map((test) => row.grades[test.id]?.percent ?? null)
        .filter((v): v is number => v != null);

      const averageScore =
        finished.length > 0
          ? Math.round(
              finished.reduce((sum, value) => sum + value, 0) / finished.length,
            )
          : null;

      return {
        ...row,
        averageScore,
      };
    })
    .sort((a, b) => {
      const aHas = a.averageScore != null;
      const bHas = b.averageScore != null;
      if (aHas && bHas) return (b.averageScore ?? 0) - (a.averageScore ?? 0);
      if (aHas) return -1;
      if (bHas) return 1;
      return a.name.localeCompare(b.name, "ru");
    });

  const allFinishedPercents = gradebookRowsWithAverage.flatMap((row) =>
    testsForGradebook
      .map((test) => row.grades[test.id]?.percent ?? null)
      .filter((v): v is number => v != null),
  );
  const avgGroupPercent =
    allFinishedPercents.length > 0
      ? Math.round(
          allFinishedPercents.reduce((sum, value) => sum + value, 0) /
            allFinishedPercents.length,
        )
      : null;

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
          <div className="flex items-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/cohorts">Назад к группам</Link>
            </Button>
          </div>

          <section className="rounded-xl border p-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{cohort.name}</h1>
                <p className="text-muted-foreground text-sm">
                  Курс: {courseRel.title}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-sm tracking-widest">
                    PIN: {cohort.pin_code}
                  </Badge>
                  {cohort.is_active ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    >
                      Набор открыт
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Набор приостановлен</Badge>
                  )}
                </div>
              </div>

              <CohortStatusToggle cohortId={cohort.id} isActive={cohort.is_active} />
            </div>
          </section>

          <section className="rounded-xl border p-6 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Управление контентом</h2>
            <CohortAssignmentManager
              cohortId={cohort.id}
              modules={lessonsForManager}
              assignedLessonIds={[...assignedLessonIds]}
            />
          </section>

          <section className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Дата записи</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      В этой группе пока нет учеников.
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.map((row) => (
                    <TableRow key={row.id}>
                      {(() => {
                        const meta = studentMetaByUserId.get(row.user_id);
                        const studentName = meta?.full_name?.trim() || row.user_id;
                        const studentEmail = meta?.email ?? "—";
                        return (
                          <>
                            <TableCell className="font-medium">
                              {studentName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {studentEmail}
                            </TableCell>
                          </>
                        );
                      })()}
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.enrolled_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        >
                          Активен
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          <CohortGradebookTable
            cohortId={cohort.id}
            tests={testsForGradebook}
            assignments={assignmentsForGradebook}
            rows={gradebookRowsWithAverage}
            avgGroupPercent={avgGroupPercent}
          />
        </main>
      </div>
    </>
  );
}
