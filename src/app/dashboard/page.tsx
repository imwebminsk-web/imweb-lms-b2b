import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getStudentDashboardCourses,
  getStudentProgress,
} from "@/app/actions/student-dashboard-actions";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { JoinCohortForm } from "@/components/dashboard/student/join-cohort-form";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    const [progressRes, coursesRes] = await Promise.all([
      getStudentProgress(user.id),
      getStudentDashboardCourses(user.id),
    ]);

    if (!progressRes.success) {
      throw new Error(progressRes.error);
    }
    if (!coursesRes.success) {
      throw new Error(coursesRes.error);
    }

    const items = progressRes.items;
    const needsAttention = items.filter(
      (i) => i.type === "assignment" && i.status === "rejected",
    );
    const courseSummaries = coursesRes.courses;

    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <JoinCohortForm />
              </div>

              <div className="px-4 lg:px-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  Моё обучение
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Ваши курсы и задания, требующие внимания.
                </p>
              </div>

              <section className="space-y-3 px-4 lg:px-6">
                <h2 className="text-2xl font-semibold tracking-tight">
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

              <section className="space-y-4 px-4 lg:px-6">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Мои курсы
                </h2>
                {courseSummaries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Вы пока не записаны ни на один курс. Введите PIN группы
                    выше.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {courseSummaries.map((course) => {
                      const percent =
                        course.totalLessons > 0
                          ? Math.round(
                              (course.completedLessons /
                                course.totalLessons) *
                                100,
                            )
                          : 0;
                      const learnHref = `/learn/${encodeURIComponent(course.slug)}`;
                      return (
                        <Card
                          key={course.id}
                          className="flex flex-col overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="line-clamp-2 text-lg leading-snug">
                              {course.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-1 flex-col gap-2 pt-0">
                            <Progress
                              value={percent}
                              className="bg-muted mt-1 h-2"
                            />
                            <p className="text-muted-foreground text-sm">
                              Пройдено {course.completedLessons} из{" "}
                              {course.totalLessons} уроков ({percent}%)
                            </p>
                          </CardContent>
                          <CardFooter className="border-border/60 border-t pt-4">
                            <Button
                              asChild
                              className="w-full"
                              variant="default"
                            >
                              <Link href={learnHref}>Перейти к курсу</Link>
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
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
