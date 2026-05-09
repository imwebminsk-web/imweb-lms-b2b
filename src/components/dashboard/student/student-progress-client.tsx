"use client";

import Link from "next/link";
import { useState } from "react";

import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StudentProgressClientProps = {
  userId: string;
  userDisplayName: string;
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

  return (
    <>
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
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Пока нет материалов по вашим курсам. Запишитесь на курс через PIN
                  группы.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
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
                  item.hasCompletedTestAttempt &&
                  item.testId != null;

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
              })
            )}
          </TableBody>
        </Table>
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
