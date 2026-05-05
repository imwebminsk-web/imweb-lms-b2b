import { redirect } from "next/navigation";

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { JoinCohortForm } from "@/components/dashboard/student/join-cohort-form";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
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

  const payload = await fetchDashboardData(user.id, profile.role);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {profile.role === "student" ? (
              <div className="px-4 lg:px-6">
                <JoinCohortForm />
              </div>
            ) : null}
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
