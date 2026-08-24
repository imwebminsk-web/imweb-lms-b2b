import { redirect } from "next/navigation";

import {
  getStudentDashboardCourses,
  getStudentProgress,
} from "@/app/actions/student-dashboard-actions";
import { getB2BDashboardCourses } from "@/app/actions/b2b-user-actions";
import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import {
  getPendingReviews,
  getStaffListForFilter,
} from "@/app/actions/teacher-dashboard-actions";
import { ActivityFeedWidget } from "@/components/dashboard/teacher/activity-feed-widget";
import { PendingReviewsWidget } from "@/components/dashboard/teacher/pending-reviews-widget";
import { StudentDashboardHome } from "@/components/dashboard/student/student-dashboard-home";
import { CorporateDashboardHome } from "@/components/dashboard/student/corporate-dashboard-home";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_MODE } from "@/lib/config/app-mode";
import { createClient } from "@/lib/supabase/server";

import { fetchDashboardData } from "./fetch-dashboard-data";

import { verifyAccess } from "@/lib/auth/rbac";

const PENDING_REVIEWS_PAGE_SIZE = 10;

export default async function Page() {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher", "student"]);
  const supabase = await createClient();

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  if (profile.role === "student") {
    const [progressRes, coursesRes, unreadRes, b2bCoursesRes] = await Promise.all([
      getStudentProgress(user.id),
      getStudentDashboardCourses(user.id),
      getUnreadCounts(),
      APP_MODE === "corporate" || APP_MODE === "all"
        ? getB2BDashboardCourses(user.id)
        : Promise.resolve({ success: true, courses: [] }),
    ]);

    if (!progressRes.success) {
      throw new Error(progressRes.error);
    }
    if (!coursesRes.success) {
      throw new Error(coursesRes.error);
    }
    if (!b2bCoursesRes.success) {
      throw new Error(b2bCoursesRes.error);
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
    const b2bCourses = b2bCoursesRes.courses;

    if (APP_MODE === "corporate") {
      return (
        <>
          <SiteHeader fullName={displayName} />
          <div className="flex flex-1 flex-col min-w-0">
            <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
              <CorporateDashboardHome courses={b2bCourses} />
            </div>
          </div>
        </>
      );
    }

    if (APP_MODE === "all") {
      return (
        <>
          <SiteHeader fullName={displayName} />
          <div className="flex flex-1 flex-col min-w-0">
            <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
              <Tabs defaultValue="school" className="mt-4 px-4 lg:px-6">
                <TabsList className="mb-4 h-auto flex-wrap rounded-xl">
                  <TabsTrigger value="school" className="rounded-lg">
                    Школа (B2C)
                  </TabsTrigger>
                  <TabsTrigger value="corporate" className="rounded-lg">
                    Корпорация (B2B)
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="school" className="mt-0">
                  <StudentDashboardHome
                    needsAttention={needsAttention}
                    courseSummaries={courseSummaries}
                    unreadMap={unreadMap}
                    cohortIdByCourseId={cohortIdByCourseId}
                  />
                </TabsContent>
                <TabsContent value="corporate" className="mt-0">
                  <CorporateDashboardHome courses={b2bCourses} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </>
      );
    }

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
  const showStaffFilter =
    profile.role === "admin" || profile.role === "head_teacher";

  const [pendingRes, staffRes] = await Promise.all([
    getPendingReviews("mine", 0, PENDING_REVIEWS_PAGE_SIZE),
    showStaffFilter
      ? getStaffListForFilter()
      : Promise.resolve({ success: true as const, staff: [] }),
  ]);

  const pendingReviews = pendingRes.success ? pendingRes.items : [];
  const pendingHasMore = pendingRes.success ? pendingRes.hasMore : false;
  const staffOptions = staffRes.success ? staffRes.staff : [];

  const pendingWidget = (
    <PendingReviewsWidget
      initialReviews={pendingReviews}
      initialHasMore={pendingHasMore}
      staffOptions={staffOptions}
      showStaffFilter={showStaffFilter}
    />
  );

  if (profile.role === "admin") {
    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards adminMetrics={payload.adminMetrics} cards={[]} />
              {pendingWidget}
              <Card>
                <CardHeader>
                  <CardTitle>Дашборд</CardTitle>
                  <CardDescription>
                    Аналитика и статистика в разработке
                  </CardDescription>
                </CardHeader>
              </Card>
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
            {pendingWidget}
            {profile.role === "teacher" ? (
              <ActivityFeedWidget events={payload.activityEvents ?? []} />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
