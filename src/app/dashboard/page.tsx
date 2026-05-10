import Link from "next/link";
import { redirect } from "next/navigation";

import { getStudentProgress } from "@/app/actions/student-dashboard-actions";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { JoinCohortForm } from "@/components/dashboard/student/join-cohort-form";
import { StudentProgressClient } from "@/components/dashboard/student/student-progress-client";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { fetchDashboardData } from "./fetch-dashboard-data";

export default async function Page() {
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

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  if (profile.role === "student") {
    const progressRes = await getStudentProgress(user.id);
    if (!progressRes.success) {
      throw new Error(progressRes.error);
    }

    const items = progressRes.items;
    const needsAttention = items.filter(
      (i) => i.type === "assignment" && i.status === "rejected",
    );

    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="flex flex-1 flex-col">
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
            <div className="px-0 lg:px-0">
              <JoinCohortForm />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Моё обучение
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Прогресс по тестам и заданиям в курсах, на которые вы записаны.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Требует внимания
              </h2>
              {needsAttention.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Нет заданий, возвращённых на доработку.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {needsAttention.map((item) => {
                    const href = `/learn/${encodeURIComponent(item.courseSlug)}/${item.lessonId}`;
                    return (
                      <li key={item.id}>
                        <Alert variant="destructive">
                          <AlertTitle>Задание на доработку</AlertTitle>
                          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm">{item.title}</span>
                            <Button size="sm" variant="secondary" asChild>
                              <Link href={href}>Перейти к уроку</Link>
                            </Button>
                          </AlertDescription>
                        </Alert>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Моя успеваемость
              </h2>
              <StudentProgressClient
                userId={user.id}
                userDisplayName={displayName}
                items={items}
              />
            </section>
          </main>
        </div>
      </>
    );
  }

  const payload = await fetchDashboardData(user.id, profile.role);

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards cards={payload.sectionCards} />
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive />
            </div>
            <DataTable data={payload.tableRows} />
          </div>
        </div>
      </div>
    </>
  );
}
