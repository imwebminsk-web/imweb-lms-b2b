import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getGlobalTeacherStudents } from "@/app/actions/student-actions";
import { StudentsTable } from "@/components/dashboard/teacher/students/students-table";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Ученики",
  description: "Все ученики ваших курсов и групп",
};

export default async function DashboardStudentsPage() {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const studentsRes = await getGlobalTeacherStudents(user.id);
  if (!studentsRes.success) {
    throw new Error(studentsRes.error);
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ученики</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Все уникальные ученики, записанные в ваши группы. Один ученик
              отображается один раз, даже если состоит в нескольких потоках.
            </p>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
            <StudentsTable students={studentsRes.students} />
          </section>
        </main>
      </div>
    </>
  );
}
