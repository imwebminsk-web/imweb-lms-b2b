"use client";

import { CheckSquare, FileText, HourglassIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  MatrixGradebookCell,
  MatrixGradebookColumn,
  MatrixGradebookData,
  MatrixGradebookStudent,
} from "@/app/actions/gradebook-actions";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GradingDisplay } from "@/components/quiz/GradingDisplay";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

function cellKey(studentId: string, columnId: string): string {
  return `${studentId}:${columnId}`;
}

function columnTooltipText(col: MatrixGradebookColumn): string {
  if (col.type === "assignment") {
    return `${col.lessonTitle} (Задание)`;
  }
  const teacherTitle =
    col.testTitleTeacher?.trim() || col.title?.trim() || "Тест";
  return `${col.lessonTitle} (${teacherTitle})`;
}

function MatrixCell({
  cell,
  column,
  studentName,
  studentAvatarUrl,
  onOpenTest,
  onOpenAssignment,
  onOpenGrading,
}: {
  cell: MatrixGradebookCell | undefined;
  column: MatrixGradebookColumn;
  studentName: string;
  studentAvatarUrl: string | null;
  onOpenTest: (payload: {
    studentId: string;
    testId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    testTitle: string;
  }) => void;
  onOpenAssignment: (payload: {
    studentId: string;
    blockId: string;
    studentName: string;
  }) => void;
  onOpenGrading: (attemptId: string) => void;
}) {
  const status = cell?.status ?? "not_started";
  const points = cell?.points ?? null;
  const isForKids = cell?.isForKids ?? false;
  const gradingVisuals = cell?.gradingVisuals ?? null;

  const isPendingReview =
    column.type === "test" && status === "pending" && Boolean(cell?.attemptId);

  const isClickable =
    isPendingReview ||
    (column.type === "test" &&
      cell?.testId &&
      (status === "completed" || status === "in_progress")) ||
    (column.type === "assignment" &&
      cell?.blockId &&
      status !== "not_started");

  function handleClick() {
    if (!cell || !isClickable) return;
    if (isPendingReview && cell.attemptId) {
      onOpenGrading(cell.attemptId);
      return;
    }
    if (column.type === "test" && cell.testId) {
      onOpenTest({
        studentId: cell.studentId,
        testId: cell.testId,
        studentName,
        studentAvatarUrl,
        testTitle: column.lessonTitle,
      });
      return;
    }
    if (column.type === "assignment" && cell.blockId) {
      onOpenAssignment({
        studentId: cell.studentId,
        blockId: cell.blockId,
        studentName,
      });
    }
  }

  if (status === "not_started" || !cell) {
    return (
      <span className="text-muted-foreground tabular-nums">—</span>
    );
  }

  if (status === "pending") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex size-full min-h-8 items-center justify-center rounded-sm hover:bg-muted/60"
        aria-label="На проверке — открыть страницу проверки"
      >
        <HourglassIcon
          className="size-4 text-amber-500 dark:text-amber-400"
          aria-hidden
        />
      </button>
    );
  }

  if (status === "in_progress" && points == null) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex size-full min-h-8 items-center justify-center rounded-sm text-amber-600 hover:bg-muted/60 dark:text-amber-400"
        aria-label="В процессе — открыть попытку"
      >
        <HourglassIcon className="size-4" aria-hidden />
      </button>
    );
  }

  if (points != null) {
    if (isForKids) {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex size-full min-h-12 items-center justify-center rounded-sm hover:bg-muted/60"
          aria-label={`Результат: ${points} баллов`}
        >
          <GradingDisplay
            score={points}
            isForKids
            totalPossiblePoints={100}
            compact
          />
        </button>
      );
    }

    const pass = points >= 50;
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex size-full min-h-8 items-center justify-center rounded-sm font-medium tabular-nums hover:bg-muted/60",
          pass
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {points}
      </button>
    );
  }

  if (status === "rejected") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="text-destructive inline-flex size-full min-h-8 items-center justify-center rounded-sm text-xs hover:bg-muted/60"
      >
        Откл.
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      className="text-muted-foreground inline-flex size-full min-h-8 items-center justify-center rounded-sm hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
    >
      —
    </button>
  );
}

export function MatrixGradebook({ data }: { data: MatrixGradebookData }) {
  const router = useRouter();
  const { students, columns, cells } = data;

  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    testTitle: string;
  } | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    studentId: string;
    blockId: string;
    studentName: string;
  } | null>(null);

  if (columns.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Нет опубликованных тестов или заданий по курсу этой группы (или не
        назначены уроки в «Управление контентом»).
      </p>
    );
  }

  if (students.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        В группе пока нет учеников — матрица появится после записи.
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 min-w-[160px] border-r bg-background">
                Ученик
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className="min-w-[100px] max-w-[100px] px-2 text-center"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex max-w-[100px] cursor-default items-center justify-center text-xs font-medium">
                        {col.type === "test" ? (
                          <CheckSquare
                            className="text-muted-foreground mr-1 inline-block size-3 shrink-0"
                            aria-hidden
                          />
                        ) : (
                          <FileText
                            className="text-muted-foreground mr-1 inline-block size-3 shrink-0"
                            aria-hidden
                          />
                        )}
                        <span className="max-w-[100px] truncate inline-block align-middle">
                          {col.lessonTitle}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-left">
                      {columnTooltipText(col)}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student: MatrixGradebookStudent) => (
              <TableRow key={student.id}>
                <TableCell className="sticky left-0 z-10 border-r bg-background font-medium">
                  <div className="flex max-w-[180px] items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={student.avatarUrl ?? undefined}
                        alt={student.name}
                      />
                      <AvatarFallback className="text-xs">
                        {initialsFromDisplayName(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate" title={student.name}>
                      {student.name}
                    </span>
                  </div>
                </TableCell>
                {columns.map((col) => {
                  const key = cellKey(student.id, col.id);
                  const cell = cells[key];
                  return (
                    <TableCell
                      key={col.id}
                      className="p-1 text-center align-middle"
                    >
                      <MatrixCell
                        cell={cell}
                        column={col}
                        studentName={student.name}
                        studentAvatarUrl={student.avatarUrl}
                        onOpenTest={setSelectedTest}
                        onOpenAssignment={setSelectedAssignment}
                        onOpenGrading={(attemptId) => {
                          router.push(
                            `/dashboard/gradebook/attempts/${attemptId}/grade`,
                          );
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
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
          lessonBlockId={selectedAssignment.blockId}
          studentId={selectedAssignment.studentId}
          studentName={selectedAssignment.studentName}
          isTeacher
        />
      ) : null}
    </TooltipProvider>
  );
}
