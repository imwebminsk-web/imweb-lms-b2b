import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CohortAssignmentManager } from "@/components/dashboard/teacher/cohorts/cohort-assignment-manager";
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
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Ученики</h2>
              <p className="text-muted-foreground text-sm">
                Откройте журнал по каждому ученику — таблица успеваемости по курсу группы.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Дата записи</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[140px] text-right">Журнал</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      В этой группе пока нет учеников.
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.map((row) => {
                    const meta = studentMetaByUserId.get(row.user_id);
                    const studentName = meta?.full_name?.trim() || row.user_id;
                    const studentEmail = meta?.email ?? "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{studentName}</TableCell>
                        <TableCell className="text-muted-foreground">{studentEmail}</TableCell>
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
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="secondary">
                            <Link
                              href={`/dashboard/cohorts/${cohort.id}/student/${row.user_id}`}
                            >
                              Журнал
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </section>
        </main>
      </div>
    </>
  );
}
