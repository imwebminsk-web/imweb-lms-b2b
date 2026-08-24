import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { isCorporateMode } from "@/lib/config/app-mode";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsClient } from "@/components/dashboard/analytics/analytics-client";
import { getAnalyticsFilters, getEmployeeAnalytics } from "@/app/actions/analytics-actions";

import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Аналитика сотрудников",
  description: "Успеваемость сотрудников в корпоративном обучении",
};

export default async function DashboardAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!isCorporateMode) {
    redirect("/dashboard");
  }

  const { user, profile } = await verifyAccess(["admin", "head_teacher"]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  const resolvedParams = await searchParams;
  const q = typeof resolvedParams.q === "string" ? resolvedParams.q : undefined;
  const team = typeof resolvedParams.team === "string" ? resolvedParams.team : undefined;
  const course = typeof resolvedParams.course === "string" ? resolvedParams.course : undefined;
  const tag = typeof resolvedParams.tag === "string" ? resolvedParams.tag : undefined;
  const defaultTab =
    resolvedParams.tab === "courses" ? "courses" : "employees";

  const filtersRes = await getAnalyticsFilters();
  const dataRes = await getEmployeeAnalytics({ q, team, course, tag });

  const data = dataRes.success ? dataRes.data : [];

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Аналитика сотрудников
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Успеваемость сотрудников в корпоративном обучении.
            </p>
          </div>
          <AnalyticsClient
            data={data}
            teams={filtersRes.teams}
            courses={filtersRes.courses}
            tags={filtersRes.tags}
            defaultTab={defaultTab}
          />
        </main>
      </div>
    </>
  );
}
