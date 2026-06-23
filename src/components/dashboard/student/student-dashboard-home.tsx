"use client";

import Link from "next/link";

import type {
  StudentDashboardCourseSummary,
  StudentProgressItem,
} from "@/app/actions/student-dashboard-actions";
import { JoinCohortForm } from "@/components/dashboard/student/join-cohort-form";
import { useLanguage } from "@/components/providers/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type StudentDashboardHomeProps = {
  needsAttention: StudentProgressItem[];
  courseSummaries: StudentDashboardCourseSummary[];
  unreadMap: Record<string, number>;
  cohortIdByCourseId: Record<string, string | null>;
};

export function StudentDashboardHome({
  needsAttention,
  courseSummaries,
  unreadMap,
  cohortIdByCourseId,
}: StudentDashboardHomeProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <JoinCohortForm />
      </div>

      <div className="px-4 lg:px-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("dashboard.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("dashboard.pageSubtitle")}
        </p>
      </div>

      <section className="space-y-3 px-4 lg:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.needsAttention")}
        </h2>
        {needsAttention.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("dashboard.noRevisionTasks")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {needsAttention.map((item) => {
              const href = `/learn/${encodeURIComponent(item.courseSlug)}/${item.lessonId}`;
              return (
                <li key={item.id}>
                  <Alert variant="destructive">
                    <AlertTitle>{t("dashboard.assignmentRevision")}</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">{item.title}</span>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={href}>{t("dashboard.goToLesson")}</Link>
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
          {t("dashboard.myCourses")}
        </h2>
        {courseSummaries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("dashboard.noCourses")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courseSummaries.map((course) => {
              const percent =
                course.totalLessons > 0
                  ? Math.round(
                      (course.completedLessons / course.totalLessons) * 100,
                    )
                  : 0;
              const learnHref = `/learn/${encodeURIComponent(course.slug)}`;
              const cohortId = cohortIdByCourseId[course.id] ?? null;
              const unreadCount =
                cohortId != null ? (unreadMap[cohortId] ?? 0) : 0;

              return (
                <Card
                  key={course.id}
                  className="relative flex flex-col overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
                >
                  {unreadCount > 0 ? (
                    <Badge
                      variant="destructive"
                      className="absolute top-2 right-2 min-w-5 justify-center px-1.5 tabular-nums"
                    >
                      {unreadCount}
                    </Badge>
                  ) : null}
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-lg leading-snug">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-2 pt-0">
                    <Progress value={percent} className="bg-muted mt-1 h-2" />
                    <p className="text-muted-foreground text-sm">
                      {t("dashboard.completed")} {course.completedLessons}{" "}
                      {t("dashboard.of")} {course.totalLessons}{" "}
                      {t("dashboard.lessons")} ({percent}%)
                    </p>
                  </CardContent>
                  <CardFooter className="border-border/60 border-t pt-4">
                    <Button asChild className="w-full" variant="default">
                      <Link href={learnHref}>{t("dashboard.goToCourse")}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
