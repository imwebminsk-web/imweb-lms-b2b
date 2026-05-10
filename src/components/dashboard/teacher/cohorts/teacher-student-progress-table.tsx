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
import { cn } from "@/lib/utils";

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

export type TeacherStudentProgressTableProps = {
  items: StudentProgressItem[];
  viewedStudentId: string;
  viewedStudentName: string;
};

/**
 * Таблица успеваемости (как вкладка «Успеваемость» в CourseHubClient) для просмотра преподавателем.
 */
export function TeacherStudentProgressTable({
  items,
  viewedStudentId,
  viewedStudentName,
}: TeacherStudentProgressTableProps) {
  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
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
              <TableHead className="w-[100px]">Оценка</TableHead>
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
                const scoreLabel =
                  item.grade10 == null ? "—" : String(item.grade10);

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
                      <TableCell>{typeBadge(item.type)}</TableCell>
                      <TableCell>
                        <ProgressStatusBadge item={item} />
                      </TableCell>
                      <TableCell className="text-sm">{scoreLabel}</TableCell>
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
                    <TableCell>{typeBadge(item.type)}</TableCell>
                    <TableCell>
                      <ProgressStatusBadge item={item} />
                    </TableCell>
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
