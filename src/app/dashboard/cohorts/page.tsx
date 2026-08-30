import type { Metadata } from "next";

import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { getPendingReviewCounts } from "@/app/actions/grading-actions";
import { getStaffCohortsDashboard } from "@/app/actions/cohort-actions";
import { CohortsList } from "@/components/dashboard/teacher/cohorts/cohorts-list";
import { CreateCohortDialog } from "@/components/dashboard/teacher/cohorts/create-cohort-dialog";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Группы",
  description: "Учебные группы и PIN-коды для курсов",
};

export default async function DashboardCohortsPage() {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);
  const isAdmin = profile.role === "admin";

  const [{ courses: courseOptions, cohorts: activeCohorts }, archivedDashboard] =
    await Promise.all([
      getStaffCohortsDashboard({ archived: false }),
      isAdmin
        ? getStaffCohortsDashboard({ archived: true })
        : Promise.resolve({ courses: [], cohorts: [] }),
    ]);

  const archivedCohorts = archivedDashboard.cohorts;

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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Группы</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Создавайте группы по курсам и выдавайте ученикам PIN для доступа.
            </p>
          </div>

          {courseOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Сначала создайте курс в разделе «Мои курсы», затем можно будет
              добавить группу.
            </p>
          ) : null}

          <Tabs defaultValue="active" className="w-full">
            <TabsList variant="line" className="mb-4 w-full justify-start">
              <TabsTrigger value="active">Открытые</TabsTrigger>
              {isAdmin ? <TabsTrigger value="archived">Архив</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="active" className="mt-0">
              <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col justify-between gap-4 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                  <CreateCohortDialog courses={courseOptions} />
                </div>
                <CohortsList
                  cohorts={activeCohorts}
                  mode="active"
                  unreadMap={unreadMap}
                  pendingMap={pendingMap}
                />
              </section>
            </TabsContent>

            {isAdmin ? (
              <TabsContent value="archived" className="mt-0">
                <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                  <CohortsList
                    cohorts={archivedCohorts}
                    mode="archived"
                    unreadMap={unreadMap}
                    pendingMap={pendingMap}
                  />
                </section>
              </TabsContent>
            ) : null}
          </Tabs>
        </main>
      </div>
    </>
  );
}
