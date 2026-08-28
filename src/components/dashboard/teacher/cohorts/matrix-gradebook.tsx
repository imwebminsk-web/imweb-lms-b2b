"use client";

import { CheckSquare, Download, FileText, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  MatrixGradebookCell,
  MatrixGradebookColumn,
  MatrixGradebookData,
  MatrixGradebookStudent,
} from "@/app/actions/gradebook-actions";
import { GradebookLegend } from "@/components/dashboard/gradebook/gradebook-legend";
import { JournalPointsDisplay } from "@/components/dashboard/gradebook/journal-points-display";
import {
  isGradebookDrawerOpenable,
  isPendingStatus,
  resolveGradebookCellVisual,
  type GradebookCellVisual,
} from "@/components/dashboard/gradebook/progress-status-visuals";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { exportGradebookToExcel } from "@/lib/export-gradebook";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

function cellKey(studentId: string, columnId: string): string {
  return `${studentId}:${columnId}`;
}

function matrixCellAriaLabel(visual: GradebookCellVisual): string | undefined {
  if (visual.kind === "status") {
    if (visual.key === "pending") {
      return "На проверке — открыть страницу проверки";
    }
    if (visual.key === "approved_pass") {
      return "Зачёт без оценки — открыть";
    }
    return "На пересдаче — открыть";
  }
  if (visual.kind === "points") {
    return `${visual.points} процентов`;
  }
  return undefined;
}

function columnTooltipText(col: MatrixGradebookColumn): string {
  if (col.type === "assignment") {
    return `${col.lessonTitle} (Задание)`;
  }
  const teacherTitle =
    col.testTitleTeacher?.trim() || col.title?.trim() || "Тест";
  if (col.testType === "training") {
    return `${col.lessonTitle} (${teacherTitle}, тренировка)`;
  }
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
    lessonId: string;
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

  const isPendingReview =
    column.type === "test" &&
    isPendingStatus(status) &&
    Boolean(cell?.attemptId);

  const hasOpenTarget =
    (column.type === "test" &&
      Boolean(cell?.attemptId || cell?.testId)) ||
    (column.type === "assignment" && Boolean(cell?.blockId));

  const isClickable =
    Boolean(cell) &&
    isGradebookDrawerOpenable(status, points) &&
    hasOpenTarget;

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
        lessonId: column.lessonId,
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

  const visual = resolveGradebookCellVisual(status, points);
  const inner = (
    <JournalPointsDisplay points={points} status={status} />
  );

  if (!isClickable) {
    return (
      <span className="inline-flex size-full min-h-8 cursor-default items-center justify-center">
        {inner}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={matrixCellAriaLabel(visual)}
      className="inline-flex size-full min-h-8 cursor-pointer items-center justify-center rounded-sm hover:bg-muted/60"
    >
      {inner}
    </button>
  );
}

export function MatrixGradebook({
  data,
  cohortId,
  cohortName,
  onStudentClick,
  nameColumnLabel = "Ученик",
  emptyColumnsText = "Нет опубликованных тестов или заданий по курсу этой группы (или не назначены уроки в «Управление контентом»).",
  emptyStudentsText = "В группе пока нет учеников — матрица появится после записи.",
}: {
  data: MatrixGradebookData;
  cohortId?: string;
  cohortName?: string;
  onStudentClick?: (student: MatrixGradebookStudent) => void;
  nameColumnLabel?: string;
  emptyColumnsText?: string;
  emptyStudentsText?: string;
}) {
  const router = useRouter();
  const { students, columns, cells } = data;

  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    testTitle: string;
    lessonId: string;
  } | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    studentId: string;
    blockId: string;
    studentName: string;
  } | null>(null);
  const [showTraining, setShowTraining] = useState(false);

  const visibleColumns = useMemo(
    () =>
      columns.filter(
        (col) => showTraining || col.testType !== "training",
      ),
    [columns, showTraining],
  );

  const hasTrainingColumns = columns.some(
    (col) => col.testType === "training",
  );

  const rows = useMemo(
    () =>
      students.map((student) => ({
        studentName: student.name,
        studentEmail: student.email,
        items: columns.map((col) => {
          const cell = cells[cellKey(student.id, col.id)];
          if (!cell) {
            return { columnId: col.id, status: "not_started" };
          }
          const status =
            cell.status === "pending" ? "pending_review" : cell.status;
          return {
            columnId: col.id,
            status,
            points: cell.points,
          };
        }),
      })),
    [students, columns, cells],
  );

  if (columns.length === 0) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-sm">{emptyColumnsText}</p>
    );
  }

  if (students.length === 0) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-sm">{emptyStudentsText}</p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <>
        <div className="flex flex-wrap items-center justify-end gap-4 border-b bg-muted/10 px-6 py-3">
          {hasTrainingColumns ? (
            <>
              <Label
                htmlFor="gradebook-show-training"
                className="text-muted-foreground font-normal"
              >
                Показывать тренировки
              </Label>
              <Switch
                id="gradebook-show-training"
                checked={showTraining}
                onCheckedChange={setShowTraining}
                aria-label="Показывать тренировочные тесты"
              />
            </>
          ) : null}
          <GradebookLegend />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportGradebookToExcel(cohortName || "Группы", columns, rows)
            }
          >
            <Download className="mr-2 size-4" /> Экспорт
          </Button>
        </div>

        {visibleColumns.length === 0 ? (
          <p className="text-muted-foreground px-6 py-4 text-sm">
            Сейчас тренировочные тесты скрыты. Включите «Показывать
            тренировки», чтобы увидеть их в журнале.
          </p>
        ) : (
          <div className="custom-scrollbar w-full overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 min-w-[200px] border-r bg-card">
                    {nameColumnLabel}
                  </TableHead>
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col.id}
                      className="min-w-[140px] max-w-[160px] px-2 text-center"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex max-w-[130px] cursor-default items-center justify-center text-xs font-medium">
                            {col.type === "assignment" ? (
                              <FileText
                                className="text-muted-foreground mr-1 inline-block size-3 shrink-0"
                                aria-hidden
                              />
                            ) : col.testType === "training" ? (
                              <Target
                                className="text-muted-foreground mr-1 inline-block size-3 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <CheckSquare
                                className="text-muted-foreground mr-1 inline-block size-3 shrink-0"
                                aria-hidden
                              />
                            )}
                            <span className="max-w-[130px] truncate inline-block align-middle">
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
                    <TableCell className="sticky left-0 z-10 min-w-[200px] border-r bg-card font-medium">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage
                            src={student.avatarUrl ?? undefined}
                            alt={student.name}
                          />
                          <AvatarFallback className="text-xs">
                            {initialsFromDisplayName(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        {onStudentClick ? (
                          <button
                            type="button"
                            className="truncate text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            title={student.name}
                            onClick={() => onStudentClick(student)}
                          >
                            {student.name}
                          </button>
                        ) : cohortId ? (
                          <Link
                            href={`/dashboard/cohorts/${cohortId}/student/${student.id}`}
                            className="truncate text-left text-primary hover:underline"
                            title={student.name}
                          >
                            {student.name}
                          </Link>
                        ) : (
                          <span className="truncate" title={student.name}>
                            {student.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {visibleColumns.map((col) => {
                      const key = cellKey(student.id, col.id);
                      const cell = cells[key];
                      return (
                        <TableCell
                          key={col.id}
                          className="min-w-[140px] p-1 text-center align-middle"
                        >
                          <MatrixCell
                            cell={cell}
                            column={col}
                            studentName={student.name}
                            studentAvatarUrl={student.avatarUrl}
                            onOpenTest={setSelectedTest}
                            onOpenAssignment={setSelectedAssignment}
                            onOpenGrading={(attemptId) => {
                              const returnTo = cohortId
                                ? `/dashboard/cohorts/${cohortId}?tab=journal`
                                : null;
                              const gradeUrl = returnTo
                                ? `/dashboard/gradebook/attempts/${attemptId}/grade?returnTo=${encodeURIComponent(returnTo)}`
                                : `/dashboard/gradebook/attempts/${attemptId}/grade`;
                              router.push(gradeUrl);
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
        )}

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
        lessonId={selectedTest?.lessonId}
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
      </>
    </TooltipProvider>
  );
}
