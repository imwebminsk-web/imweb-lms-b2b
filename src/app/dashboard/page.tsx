import { redirect } from "next/navigation";

import {
  getStudentDashboardCourses,
  getStudentProgress,
} from "@/app/actions/student-dashboard-actions";
import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { UsersTable } from "@/components/dashboard/admin/users-table";
import { ActivityFeedWidget } from "@/components/dashboard/teacher/activity-feed-widget";
import { PendingReviewsWidget } from "@/components/dashboard/teacher/pending-reviews-widget";
import { StudentDashboardHome } from "@/components/dashboard/student/student-dashboard-home";
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

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  if (profile.role === "student") {
    const [progressRes, coursesRes, unreadRes] = await Promise.all([
      getStudentProgress(user.id),
      getStudentDashboardCourses(user.id),
      getUnreadCounts(),
    ]);

    if (!progressRes.success) {
      throw new Error(progressRes.error);
    }
    if (!coursesRes.success) {
      throw new Error(coursesRes.error);
    }

    const unreadMap = unreadRes.success ? unreadRes.counts : {};

    const { data: enrollRows, error: enrollError } = await supabase
      .from("enrollments")
      .select("course_id, cohort_id")
      .eq("user_id", user.id);

    if (enrollError) {
      console.error("[StudentDashboard] enrollments", enrollError.message);
    }

    const cohortIdByCourseId: Record<string, string | null> = {};
    for (const row of enrollRows ?? []) {
      cohortIdByCourseId[row.course_id] = row.cohort_id;
    }

    const items = progressRes.items;
    const needsAttention = items.filter(
      (i) => i.type === "assignment" && i.status === "rejected",
    );
    const courseSummaries = coursesRes.courses;

    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="flex flex-1 flex-col min-w-0">
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
            <StudentDashboardHome
              needsAttention={needsAttention}
              courseSummaries={courseSummaries}
              unreadMap={unreadMap}
              cohortIdByCourseId={cohortIdByCourseId}
            />
          </div>
        </div>
      </>
    );
  }

  const payload = await fetchDashboardData(user.id, profile.role);

  if (profile.role === "admin") {
    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards adminMetrics={payload.adminMetrics} cards={[]} />
              <UsersTable
                users={payload.adminUsers ?? []}
                currentUserId={user.id}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards
              cards={payload.sectionCards}
              teacherMetrics={payload.teacherMetrics}
            />
            {profile.role === "teacher" ? (
              <>
                <PendingReviewsWidget
                  reviews={payload.pendingReviews ?? []}
                />
                <ActivityFeedWidget events={payload.activityEvents ?? []} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
