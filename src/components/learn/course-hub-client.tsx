"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { LearnCourseCurriculum } from "@/lib/learn/fetch-published-course";
import {
  publishedLessonsSorted,
  sortModules,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";

export type CourseHubClientProps = {
  course: LearnCourseCurriculum;
  modules: LearnModuleNav[];
  completedLessonIds: string[];
  courseProgress: StudentProgressItem[];
  userId: string;
  userDisplayName: string;
};

function statusBadge(status: StudentProgressItem["status"]) {
  switch (status) {
    case "passed":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        >
          Сдан
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Не сдан</Badge>;
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
        >
          На проверке
        </Badge>
      );
    case "approved":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        >
          Принято
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">На доработку</Badge>;
    default:
      return <Badge variant="secondary">Не начато</Badge>;
  }
}

function typeBadge(type: StudentProgressItem["type"]) {
  if (type === "test") {
    return <Badge variant="secondary">Тест</Badge>;
  }
  return (
    <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10">
      Задание
    </Badge>
  );
}

/** Первый непройденный урок по порядку; если все пройдены — первый урок курса. */
function getContinueLessonHref(
  modules: LearnModuleNav[],
  completedIds: Set<string>,
  courseSlug: string,
): string | null {
  const sortedMods = sortModules(modules);
  let firstAny: string | null = null;
  for (const mod of sortedMods) {
    for (const l of publishedLessonsSorted(mod.lessons)) {
      if (firstAny == null) firstAny = l.id;
      if (!completedIds.has(l.id)) {
        return `/learn/${encodeURIComponent(courseSlug)}/${l.id}`;
      }
    }
  }
  return firstAny
    ? `/learn/${encodeURIComponent(courseSlug)}/${firstAny}`
    : null;
}

export function CourseHubClient({
  course,
  modules,
  completedLessonIds,
  courseProgress,
  userId,
  userDisplayName,
}: CourseHubClientProps) {
  const completedSet = useMemo(
    () => new Set(completedLessonIds),
    [completedLessonIds],
  );

  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    testTitle: string;
  } | null>(null);

  const continueHref = useMemo(
    () => getContinueLessonHref(modules, completedSet, course.slug),
    [modules, completedSet, course.slug],
  );

  return (
    <>
      <div className="space-y-6">
        <header className="space-y-4">
          <Button
            variant="ghost"
            asChild
            className="-ml-4 mb-2 w-fit text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard" className="inline-flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              На дашборд
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {course.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              Программа курса и ваша успеваемость
            </p>
          </div>
          {continueHref ? (
            <Button asChild>
              <Link href={continueHref}>Продолжить обучение</Link>
            </Button>
          ) : (
            <Button type="button" disabled variant="secondary">
              Продолжить обучение
            </Button>
          )}
        </header>

        <Tabs defaultValue="syllabus" className="w-full">
          <TabsList variant="line" className="mb-4 w-full justify-start">
            <TabsTrigger value="syllabus">Программа</TabsTrigger>
            <TabsTrigger value="progress">Успеваемость</TabsTrigger>
          </TabsList>

          <TabsContent value="syllabus" className="mt-0 space-y-8">
            {modules.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                В курсе пока нет модулей.
              </p>
            ) : (
              modules.map((mod) => {
                const lessons = publishedLessonsSorted(mod.lessons);
                return (
                  <section key={mod.id} className="space-y-3">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {mod.title}
                    </h2>
                    {lessons.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Нет опубликованных уроков в этом модуле.
                      </p>
                    ) : (
                      <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
                        {lessons.map((lesson) => {
                          const done = completedSet.has(lesson.id);
                          const href = `/learn/${encodeURIComponent(course.slug)}/${lesson.id}`;
                          return (
                            <li key={lesson.id}>
                              <Link
                                href={href}
                                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                              >
                                {done ? (
                                  <CheckCircle2
                                    className="text-emerald-600 size-5 shrink-0 dark:text-emerald-400"
                                    aria-label="Урок пройден"
                                  />
                                ) : (
                                  <Circle
                                    className="text-muted-foreground size-5 shrink-0"
                                    aria-label="Урок не отмечен как пройденный"
                                  />
                                )}
                                <span className="min-w-0 flex-1 font-medium leading-snug">
                                  {lesson.title}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Название</TableHead>
                    <TableHead className="w-[100px]">Тип</TableHead>
                    <TableHead className="w-[140px]">Статус</TableHead>
                    <TableHead className="w-[100px]">Оценка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseProgress.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-10 text-center text-sm"
                      >
                        Пока нет тестов и заданий по этому курсу в вашей
                        успеваемости.
                      </TableCell>
                    </TableRow>
                  ) : (
                    courseProgress.map((item) => {
                      const learnHref = `/learn/${encodeURIComponent(item.courseSlug)}/${item.lessonId}`;
                      const scoreLabel =
                        item.type === "test"
                          ? item.scorePercent == null
                            ? "—"
                            : `${item.scorePercent}%`
                          : item.grade != null
                            ? String(item.grade)
                            : item.status === "approved"
                              ? "—"
                              : "—";

                      if (item.type === "assignment") {
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Link
                                href={learnHref}
                                className="text-primary font-medium hover:underline"
                              >
                                {item.title}
                              </Link>
                              <p className="text-muted-foreground mt-1 text-xs">
                                Перейти к уроку для ответа или доработки
                              </p>
                            </TableCell>
                            <TableCell>{typeBadge(item.type)}</TableCell>
                            <TableCell>{statusBadge(item.status)}</TableCell>
                            <TableCell className="text-sm">
                              {scoreLabel}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const openSheet =
                        item.hasCompletedTestAttempt && item.testId != null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {openSheet ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedTest({
                                    studentId: userId,
                                    testId: item.testId!,
                                    studentName: userDisplayName,
                                    testTitle: item.title,
                                  })
                                }
                                className={cn(
                                  "text-primary cursor-pointer text-left font-medium hover:underline",
                                )}
                              >
                                {item.title}
                              </button>
                            ) : (
                              <span className="font-medium">{item.title}</span>
                            )}
                            {openSheet ? (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Нажмите, чтобы открыть разбор попытки
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>{typeBadge(item.type)}</TableCell>
                          <TableCell>{statusBadge(item.status)}</TableCell>
                          <TableCell className="text-sm">{scoreLabel}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <TestResultSheet
        isOpen={selectedTest != null}
        onOpenChange={(open) => {
          if (!open) setSelectedTest(null);
        }}
        studentId={selectedTest?.studentId ?? ""}
        testId={selectedTest?.testId ?? ""}
        studentName={selectedTest?.studentName ?? ""}
        testTitle={selectedTest?.testTitle ?? ""}
      />
    </>
  );
}
