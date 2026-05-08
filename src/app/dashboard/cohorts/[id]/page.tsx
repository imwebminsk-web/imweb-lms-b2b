import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CohortAssignmentManager } from "@/components/dashboard/teacher/cohorts/cohort-assignment-manager";
import { CohortStatusToggle } from "@/components/dashboard/teacher/cohorts/cohort-status-toggle";
import { ExportCsvButton } from "@/components/dashboard/teacher/cohorts/export-csv-button";
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

type GradeCell = {
  percent: number | null;
  status: "passed" | "failed" | "not_started";
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

function statusBadge(cell: GradeCell) {
  if (cell.status === "not_started") {
    return <Badge variant="secondary">Не начат</Badge>;
  }
  if (cell.status === "passed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      >
        Сдан
      </Badge>
    );
  }
  return <Badge variant="destructive">Не сдан</Badge>;
}

const PASS_PERCENT = 60;

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
    const grades: Record<string, GradeCell> = {};

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

    return {
      userId: row.user_id,
      name: studentName,
      email: studentEmail,
      grades,
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

          <section className="rounded-xl border p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Журнал оценок</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  Средний балл группы:{" "}
                  {avgGroupPercent == null ? "—" : `${avgGroupPercent}%`}
                </Badge>
                <ExportCsvButton
                  cohortId={cohort.id}
                  testTitles={testsForGradebook.map((test) => test.title)}
                  rows={gradebookRowsWithAverage.map((row) => ({
                    studentName: row.name,
                    email: row.email,
                    scores: testsForGradebook.map(
                      (test) => row.grades[test.id]?.percent ?? null,
                    ),
                    averageScore: row.averageScore,
                  }))}
                />
              </div>
            </div>

            {testsForGradebook.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                В курсе пока нет тестов, привязанных к урокам.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Ученик</TableHead>
                      {testsForGradebook.map((test) => (
                        <TableHead key={test.id} className="min-w-[210px]">
                          {test.title}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradebookRowsWithAverage.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={testsForGradebook.length + 1}
                          className="text-muted-foreground text-center"
                        >
                          Нет студентов для отображения журнала.
                        </TableCell>
                      </TableRow>
                    ) : (
                      gradebookRowsWithAverage.map((row) => (
                        <TableRow key={row.userId}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{row.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {row.email}
                              </span>
                            </div>
                          </TableCell>
                          {testsForGradebook.map((test) => {
                            const cell = row.grades[test.id];
                            return (
                              <TableCell key={test.id}>
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm">
                                    {cell.percent == null ? "—" : `${cell.percent}%`}
                                  </span>
                                  {statusBadge(cell)}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
