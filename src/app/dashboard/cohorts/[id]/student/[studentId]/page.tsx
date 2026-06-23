import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getStudentProgressForTeacher } from "@/app/actions/student-dashboard-actions";
import { TeacherStudentProgressTable } from "@/components/dashboard/teacher/cohorts/teacher-student-progress-table";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import {
  resolveStudentDisplayName,
  initialsFromDisplayName,
} from "@/lib/utils/user-utils";

type PageProps = {
  params: Promise<{ id: string; studentId: string }>;
};

export default async function CohortStudentJournalPage({ params }: PageProps) {
  const { id: cohortId, studentId } = await params;
  const cohortIdTrim = cohortId?.trim();
  const studentIdTrim = studentId?.trim();

  if (!cohortIdTrim || !studentIdTrim) {
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

  const progressRes = await getStudentProgressForTeacher(
    studentIdTrim,
    cohortIdTrim,
  );

  if (!progressRes.success) {
    if (
      progressRes.error === "Ученик не записан в эту группу" ||
      progressRes.error === "Группа не найдена"
    ) {
      notFound();
    }
    redirect(`/dashboard/cohorts/${cohortIdTrim}`);
  }

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", studentIdTrim)
    .maybeSingle();

  const { data: emailRpc } = await supabase.rpc("get_cohort_student_emails", {
    p_cohort_id: cohortIdTrim,
  });
  type EmailRow = { user_id: string; email: string | null; full_name: string | null };
  const emailRow = ((emailRpc ?? []) as EmailRow[]).find(
    (r) => r.user_id === studentIdTrim,
  );

  const studentName = resolveStudentDisplayName(
    studentProfile?.full_name ?? emailRow?.full_name,
    emailRow?.email,
    studentIdTrim,
  );

  const studentAvatarUrl = studentProfile?.avatar_url ?? null;

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <Link href={`/dashboard/cohorts/${cohortIdTrim}`}>
                Назад к группе
              </Link>
            </Button>
          </div>

          <header className="space-y-1">
            <p className="text-muted-foreground text-sm">
              {progressRes.cohortName ? `Группа: ${progressRes.cohortName}` : null}
              {progressRes.cohortName && progressRes.courseTitle ? " · " : null}
              {progressRes.courseTitle ? `Курс: ${progressRes.courseTitle}` : null}
            </p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={studentAvatarUrl ?? undefined}
                  alt={studentName}
                />
                <AvatarFallback>
                  {initialsFromDisplayName(studentName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Журнал: {studentName}
                </h1>
                {emailRow?.email ? (
                  <p className="text-muted-foreground text-sm">{emailRow.email}</p>
                ) : null}
              </div>
            </div>
          </header>

          <TeacherStudentProgressTable
            items={progressRes.items}
            viewedStudentId={studentIdTrim}
            viewedStudentName={studentName}
            viewedStudentAvatarUrl={studentAvatarUrl}
          />
        </main>
      </div>
    </>
  );
}
