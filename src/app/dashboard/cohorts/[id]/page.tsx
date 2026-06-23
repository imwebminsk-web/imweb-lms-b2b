import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { getPendingReviewCounts } from "@/app/actions/grading-actions";
import { getCohortStudents } from "@/app/actions/cohort-actions";
import { getMatrixGradebookData } from "@/app/actions/gradebook-actions";
import { CohortChat } from "@/components/dashboard/chat/cohort-chat";
import { TeacherCohortTabs } from "@/components/dashboard/cohorts/teacher-cohort-tabs";
import { CohortAssignmentManager } from "@/components/dashboard/teacher/cohorts/cohort-assignment-manager";
import { CohortSettingsForm } from "@/components/dashboard/teacher/cohorts/cohort-settings-form";
import { CohortStudentsList } from "@/components/dashboard/teacher/cohorts/cohort-students-list";
import { CohortStatusToggle } from "@/components/dashboard/teacher/cohorts/cohort-status-toggle";
import { MatrixGradebook } from "@/components/dashboard/teacher/cohorts/matrix-gradebook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

type CohortPageProps = {
  params: Promise<{ id: string }>;
};

type LessonWithTestRow = {
  id: string;
  title: string;
  order_index: number;
  module_id: string;
  test_id: string | null;
  is_published: boolean;
  tests: { id: string; title: string } | { id: string; title: string }[] | null;
  modules:
    | { id: string; title: string; order_index: number; course_id: string }
    | { id: string; title: string; order_index: number; course_id: string }[]
    | null;
};

type CohortAssignmentRow = {
  lesson_id: string | null;
};

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
    .select(
      "id, name, pin_code, is_active, is_chat_enabled, created_at, course_id, courses(id, title, teacher_id)",
    )
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

  const [studentsRes, matrixRes, unreadRes, pendingRes] = await Promise.all([
    getCohortStudents(cohort.id),
    getMatrixGradebookData(cohort.id),
    getUnreadCounts(),
    getPendingReviewCounts(),
  ]);

  const cohortStudents = studentsRes.success ? studentsRes.students : [];
  const unreadMap = unreadRes.success ? unreadRes.counts : {};
  const unreadCount = unreadMap[cohort.id] ?? 0;
  const pendingMap = pendingRes.success ? pendingRes.counts : {};
  const pendingReviewCount = pendingMap[cohort.id] ?? 0;

  const { data: lessonsRaw, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      "id, title, order_index, module_id, test_id, is_published, tests(id, title), modules!inner(id, title, order_index, course_id)",
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
    {
      id: string;
      title: string;
      position: number;
      lessons: {
        id: string;
        title: string;
        hasTest: boolean;
        isPublished: boolean;
      }[];
    }
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
      isPublished: lesson.is_published,
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

  const managementNode = (
    <>
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

      <CohortSettingsForm
        cohort={{
          id: cohort.id,
          name: cohort.name,
          is_chat_enabled: cohort.is_chat_enabled,
        }}
      />

      <section className="rounded-xl border p-6 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Управление контентом</h2>
        <CohortAssignmentManager
          cohortId={cohort.id}
          modules={lessonsForManager}
          assignedLessonIds={[...assignedLessonIds]}
        />
      </section>
    </>
  );

  const journalNode = (
    <>
      <section className="rounded-xl border overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Сводный журнал
          </h2>
          <p className="text-muted-foreground text-sm">
            Ученики в строках, тесты и задания в колонках. Нажмите на ячейку,
            чтобы открыть разбор.
          </p>
        </div>
        <div className="p-4">
          {matrixRes.success ? (
            <MatrixGradebook data={matrixRes.data} />
          ) : (
            <p className="text-destructive text-sm" role="alert">
              {matrixRes.error}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="border-b px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">Ученики</h2>
          <p className="text-muted-foreground text-sm">
            Откройте журнал по каждому ученику — таблица успеваемости по курсу группы.
          </p>
        </div>
        <div className="px-4 pb-4 sm:px-6">
          <CohortStudentsList cohortId={cohort.id} students={cohortStudents} />
        </div>
      </section>
    </>
  );

  const chatNode = (
    <CohortChat
      key={cohort.id}
      cohortId={cohort.id}
      currentUserId={user.id}
      teacherId={courseRel.teacher_id}
      isChatEnabled={cohort.is_chat_enabled}
      isTeacher
      description="Общение с учениками группы в реальном времени."
    />
  );

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
          <div className="flex items-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/cohorts">Назад к группам</Link>
            </Button>
          </div>

          <TeacherCohortTabs
            managementNode={managementNode}
            journalNode={journalNode}
            chatNode={chatNode}
            unreadCount={unreadCount}
            pendingReviewCount={pendingReviewCount}
          />
        </main>
      </div>
    </>
  );
}
