"use client";

import { useState } from "react";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { ProgressStatusBadge } from "@/components/learn/progress-status-badge";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JournalPointsDisplay } from "@/components/dashboard/gradebook/journal-points-display";
import { cn } from "@/lib/utils";

function typeBadge(
  type: StudentProgressItem["type"],
  testType?: StudentProgressItem["testType"],
) {
  if (type === "test") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge
          variant="outline"
          className="border-violet-500/35 bg-violet-500/10 text-violet-900 dark:text-violet-100"
        >
          Тест
        </Badge>
        <span className="text-muted-foreground text-xs">
          {testType === "training" ? "(тренировочный)" : "(итоговый)"}
        </span>
      </span>
    );
  }
  return (
    <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10">
      Задание
    </Badge>
  );
}

export type TeacherStudentProgressTableProps = {
  items: StudentProgressItem[];
  viewedStudentId: string;
  viewedStudentName: string;
  viewedStudentAvatarUrl?: string | null;
};

/**
 * Таблица успеваемости (как вкладка «Успеваемость» в CourseHubClient) для просмотра преподавателем.
 */
export function TeacherStudentProgressTable({
  items,
  viewedStudentId,
  viewedStudentName,
  viewedStudentAvatarUrl = null,
}: TeacherStudentProgressTableProps) {
  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    testTitle: string;
  } | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    lessonBlockId: string;
  } | null>(null);

  return (
    <>
      <p className="text-muted-foreground mb-4 text-sm">
        Нажмите на строку с тестом или заданием, чтобы открыть подробности.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Урок</TableHead>
              <TableHead className="w-[100px]">Тип</TableHead>
              <TableHead className="w-[140px]">Статус</TableHead>
              <TableHead className="w-[100px]">Баллы</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  Пока нет тестов и заданий по этому курсу в успеваемости ученика.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const pointsCell = (
                  <JournalPointsDisplay
                    points={item.points}
                    isForKids={item.isForKids}
                    compact
                  />
                );

                if (item.type === "assignment") {
                  const blockId = item.lessonBlockId;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {blockId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAssignment({ lessonBlockId: blockId })
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
                      </TableCell>
                      <TableCell>{typeBadge(item.type, item.testType)}</TableCell>
                      <TableCell>
                        <ProgressStatusBadge item={item} />
                      </TableCell>
                      <TableCell className="text-sm">{pointsCell}</TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.testId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTest({
                              studentId: viewedStudentId,
                              testId: item.testId!,
                              studentName: viewedStudentName,
                              studentAvatarUrl: viewedStudentAvatarUrl,
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
                    </TableCell>
                    <TableCell>{typeBadge(item.type, item.testType)}</TableCell>
                    <TableCell>
                      <ProgressStatusBadge item={item} />
                    </TableCell>
                    <TableCell className="text-sm">{pointsCell}</TableCell>
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
        studentAvatarUrl={selectedTest?.studentAvatarUrl ?? null}
        testTitle={selectedTest?.testTitle ?? ""}
        isTeacher
      />

      {selectedAssignment ? (
        <AssignmentReviewSheet
          isOpen
          onOpenChange={(open) => {
            if (!open) setSelectedAssignment(null);
          }}
          fetchMode="lessonBlock"
          lessonBlockId={selectedAssignment.lessonBlockId}
          studentId={viewedStudentId}
          studentName={viewedStudentName}
          isTeacher
        />
      ) : null}
    </>
  );
}
