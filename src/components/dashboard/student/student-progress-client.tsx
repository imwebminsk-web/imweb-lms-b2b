"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { cn } from "@/lib/utils";

type StudentProgressClientProps = {
  userId: string;
  userDisplayName: string;
  items: StudentProgressItem[];
};

type CourseProgressGroup = {
  id: string;
  slug: string;
  title: string;
  items: StudentProgressItem[];
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

function countCompleted(items: StudentProgressItem[]): number {
  return items.filter(
    (i) =>
      (i.type === "test" && i.status === "passed") ||
      (i.type === "assignment" && i.status === "approved"),
  ).length;
}

function completionPercent(items: StudentProgressItem[]): number {
  const total = items.length;
  if (total === 0) return 0;
  return Math.round((countCompleted(items) / total) * 100);
}

export function StudentProgressClient({
  userId,
  userDisplayName,
  items,
}: StudentProgressClientProps) {
  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    testTitle: string;
  } | null>(null);

  const courses = useMemo((): CourseProgressGroup[] => {
    const byCourse = new Map<string, StudentProgressItem[]>();
    for (const item of items) {
      const list = byCourse.get(item.courseId) ?? [];
      list.push(item);
      byCourse.set(item.courseId, list);
    }
    return [...byCourse.entries()].map(([id, courseItems]) => {
      const first = courseItems[0]!;
      return {
        id,
        slug: first.courseSlug,
        title: first.courseTitle,
        items: courseItems,
      };
    });
  }, [items]);

  function renderProgressBlock(course: CourseProgressGroup) {
    const total = course.items.length;
    const completed = countCompleted(course.items);
    const pct = completionPercent(course.items);

    return (
      <div className="space-y-3">
        <Progress value={pct} className="h-2" />
        <p className="text-muted-foreground text-sm">
          Пройдено {completed} из {total}
          {total > 0 ? ` (${pct}%)` : null}
        </p>
      </div>
    );
  }

  function renderTable(courseItems: StudentProgressItem[]) {
    return (
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
            {courseItems.map((item) => {
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
                    <TableCell className="text-sm">{scoreLabel}</TableCell>
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
                          "text-left font-medium hover:underline",
                          "text-primary cursor-pointer",
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
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderCourseCard(course: CourseProgressGroup) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{course.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderProgressBlock(course)}
          {renderTable(course.items)}
        </CardContent>
      </Card>
    );
  }

  let main: ReactNode;
  if (courses.length === 0) {
    main = (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          Вы пока не записаны ни на один курс.
        </CardContent>
      </Card>
    );
  } else if (courses.length === 1) {
    main = renderCourseCard(courses[0]!);
  } else {
    main = (
      <Tabs defaultValue={courses[0]!.id} className="w-full">
        <TabsList
          variant="line"
          className="mb-4 h-auto w-full flex-wrap justify-start gap-1"
        >
          {courses.map((c) => (
            <TabsTrigger
              key={c.id}
              value={c.id}
              className="max-w-[220px] shrink"
            >
              <span className="truncate">{c.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {courses.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-0">
            {renderCourseCard(c)}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return (
    <>
      {main}
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
