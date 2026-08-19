"use client";

import Link from "next/link";

import type { StudentDashboardCourseSummary } from "@/app/actions/student-dashboard-actions";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CorporateDashboardHomeProps = {
  courses: StudentDashboardCourseSummary[];
};

export function CorporateDashboardHome({
  courses,
}: CorporateDashboardHomeProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Мое корпоративное обучение
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Курсы, назначенные вам в рамках корпоративного обучения.
        </p>
      </div>

      <section className="space-y-4 px-4 lg:px-6">
        {courses.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            У вас пока нет назначенных курсов.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => {
              const percent =
                course.totalLessons > 0
                  ? Math.round(
                      (course.completedLessons / course.totalLessons) * 100,
                    )
                  : 0;
              const learnHref = `/learn/${encodeURIComponent(course.slug)}`;

              return (
                <Card
                  key={course.id}
                  className="relative flex flex-col overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
                >
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
