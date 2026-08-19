import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { isAdminOrHead } from "@/lib/utils/user-utils";
import { getPendingReviewCounts } from "@/app/actions/grading-actions";
import {
  CohortsList,
  type CohortListRow,
} from "@/components/dashboard/teacher/cohorts/cohorts-list";
import { CreateCohortDialog } from "@/components/dashboard/teacher/cohorts/create-cohort-dialog";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Группы",
  description: "Учебные группы и PIN-коды для курсов",
};

export default async function DashboardCohortsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/");
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin" &&
    profile.role !== "head_teacher"
  ) {
    redirect("/dashboard");
  }

  const privileged = isAdminOrHead(profile.role);

  let coursesQuery = supabase.from("courses").select("id, title").order("title");
  if (!privileged) {
    coursesQuery = coursesQuery.eq("teacher_id", user.id);
  }

  const { data: myCourses, error: coursesError } = await coursesQuery;

  if (coursesError) {
    console.error("[DashboardCohortsPage] courses", coursesError.message);
  }

  const courseOptions = (myCourses ?? []).map((c) => ({
    id: c.id,
    title: c.title,
  }));

  const courseIds = courseOptions.map((c) => c.id);

  let cohortRows: CohortListRow[] = [];
  if (privileged || courseIds.length > 0) {
    let cohortsQuery = supabase
      .from("cohorts")
      .select("id, name, pin_code, is_active, created_at, courses(title)")
      .order("created_at", { ascending: false });

    if (!privileged) {
      cohortsQuery = cohortsQuery.in("course_id", courseIds);
    }

    const { data: cohortsData, error: cohortsError } = await cohortsQuery;

    if (cohortsError) {
      console.error("[DashboardCohortsPage] cohorts", cohortsError.message);
    }
    cohortRows = (cohortsData ?? []) as CohortListRow[];
  }

  const [unreadRes, pendingRes] = await Promise.all([
    getUnreadCounts(),
    getPendingReviewCounts(),
  ]);
  const unreadMap = unreadRes.success ? unreadRes.counts : {};
  const pendingMap = pendingRes.success ? pendingRes.counts : {};

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Группы</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Создавайте группы по курсам и выдавайте ученикам PIN для доступа.
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-auto">
              <CreateCohortDialog courses={courseOptions} />
            </div>
          </div>

          {courseOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Сначала создайте курс в разделе «Мои курсы», затем можно будет
              добавить группу.
            </p>
          ) : null}

          <CohortsList
            cohorts={cohortRows}
            unreadMap={unreadMap}
            pendingMap={pendingMap}
          />
        </main>
      </div>
    </>
  );
}
