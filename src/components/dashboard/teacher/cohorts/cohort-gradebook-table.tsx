"use client";

import { CheckCircle2Icon, CircleDashedIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";

import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { ExportCsvButton } from "@/components/dashboard/teacher/cohorts/export-csv-button";
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

export type GradebookCell = {
  percent: number | null;
  status: "passed" | "failed" | "not_started";
};

export type GradebookAssignmentStatus =
  | "not_started"
  | "pending"
  | "approved"
  | "rejected";

export type GradebookAssignmentCell = {
  status: GradebookAssignmentStatus;
  grade: number | null;
  submissionId: string | null;
};

export type CohortGradebookRow = {
  userId: string;
  name: string;
  email: string;
  grades: Record<string, GradebookCell>;
  assignmentCells: Record<string, GradebookAssignmentCell>;
  /** Добавляется при построении строк на сервере; до шага «средний» может отсутствовать. */
  averageScore?: number | null;
};

export type GradebookAssignmentColumn = {
  id: string;
  title: string;
};

type CohortGradebookTableProps = {
  cohortId: string;
  tests: { id: string; title: string }[];
  assignments: GradebookAssignmentColumn[];
  rows: CohortGradebookRow[];
  avgGroupPercent: number | null;
};

function statusBadge(cell: GradebookCell) {
  if (cell.status === "not_started") {
    return <Badge variant="secondary">Не начат</Badge>;
  }
  if (cell.status === "passed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      >
        Сдан
      </Badge>
    );
  }
  return <Badge variant="destructive">Не сдан</Badge>;
}

function assignmentStatusLabel(status: GradebookAssignmentStatus): string {
  switch (status) {
    case "pending":
      return "На проверке";
    case "approved":
      return "Принято";
    case "rejected":
      return "На доработку";
    default:
      return "Не сдано";
  }
}

function assignmentStatusForCsv(cell: GradebookAssignmentCell): string {
  const base = assignmentStatusLabel(cell.status);
  if (cell.status === "approved" && cell.grade != null) {
    return `${base} (${cell.grade})`;
  }
  return base;
}

function AssignmentCellVisual({ cell }: { cell: GradebookAssignmentCell }) {
  const label = assignmentStatusLabel(cell.status);
  switch (cell.status) {
    case "pending":
      return (
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            ⏳
          </span>
          <span className="text-amber-600 text-xs font-medium dark:text-amber-400">
            {label}
          </span>
        </div>
      );
    case "approved":
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2Icon
            className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
              {label}
            </span>
            {cell.grade != null ? (
              <span className="text-muted-foreground text-xs">Оценка: {cell.grade}</span>
            ) : null}
          </div>
        </div>
      );
    case "rejected":
      return (
        <div className="flex items-center gap-2">
          <XCircleIcon
            className="text-destructive size-5 shrink-0"
            aria-hidden
          />
          <span className="text-destructive text-xs font-medium">{label}</span>
        </div>
      );
    default:
      return (
        <div className="text-muted-foreground flex items-center gap-2">
          <CircleDashedIcon className="size-4 shrink-0" aria-hidden />
          <span className="text-xs">{label}</span>
        </div>
      );
  }
}

export function CohortGradebookTable({
  cohortId,
  tests,
  assignments,
  rows,
  avgGroupPercent,
}: CohortGradebookTableProps) {
  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    testTitle: string;
  } | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    submissionId: string;
    studentName: string;
    assignmentTitle: string;
  } | null>(null);

  const columnTitles = [
    ...tests.map((t) => t.title),
    ...assignments.map((a) => a.title),
  ];

  const exportRows = rows.map((row) => ({
    studentName: row.name,
    email: row.email,
    scores: [
      ...tests.map((test) => row.grades[test.id]?.percent ?? null),
      ...assignments.map((a) => assignmentStatusForCsv(row.assignmentCells[a.id])),
    ],
    averageScore: row.averageScore ?? null,
  }));

  const hasAnyColumns = tests.length > 0 || assignments.length > 0;
  const totalColumns = tests.length + assignments.length;

  return (
    <>
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Журнал оценок</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Средний балл группы (тесты):{" "}
              {avgGroupPercent == null ? "—" : `${avgGroupPercent}%`}
            </Badge>
            {hasAnyColumns ? (
              <ExportCsvButton
                cohortId={cohortId}
                columnTitles={columnTitles}
                rows={exportRows}
              />
            ) : null}
          </div>
        </div>

        {!hasAnyColumns ? (
          <p className="text-muted-foreground text-sm">
            В курсе пока нет тестов у отфильтрованных уроков и блоков-заданий для журнала.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Ученик</TableHead>
                  {tests.map((test) => (
                    <TableHead key={test.id} className="min-w-[210px]">
                      <span className="text-muted-foreground mr-1 text-xs font-normal">
                        Тест
                      </span>
                      {test.title}
                    </TableHead>
                  ))}
                  {assignments.map((col) => (
                    <TableHead key={col.id} className="min-w-[200px]">
                      <span className="text-muted-foreground mr-1 text-xs font-normal">
                        Задание
                      </span>
                      {col.title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={totalColumns + 1}
                      className="text-muted-foreground text-center"
                    >
                      Нет студентов для отображения журнала.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.email}
                          </span>
                        </div>
                      </TableCell>
                      {tests.map((test) => {
                        const cell = row.grades[test.id];
                        const hasAttempt =
                          cell.percent != null && cell.status !== "not_started";
                        return (
                          <TableCell key={test.id}>
                            {hasAttempt ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedTest({
                                    studentId: row.userId,
                                    testId: test.id,
                                    studentName: row.name,
                                    testTitle: test.title,
                                  })
                                }
                                className={cn(
                                  "hover:bg-muted/80 flex w-full min-w-0 flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors",
                                  "cursor-pointer focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                                )}
                              >
                                <span className="text-sm">
                                  {cell.percent == null ? "—" : `${cell.percent}%`}
                                </span>
                                {statusBadge(cell)}
                              </button>
                            ) : (
                              <div
                                className="text-muted-foreground flex w-full min-w-0 cursor-not-allowed flex-col gap-1 rounded-md px-2 py-1.5 opacity-80"
                                aria-label="Нет завершённой попытки"
                              >
                                <span className="text-sm">—</span>
                                {statusBadge(cell)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      {assignments.map((col) => {
                        const cell = row.assignmentCells[col.id] ?? {
                          status: "not_started" as const,
                          grade: null,
                          submissionId: null,
                        };
                        const canOpenReview =
                          cell.status !== "not_started" &&
                          cell.submissionId != null;

                        return (
                          <TableCell key={col.id}>
                            {canOpenReview ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedAssignment({
                                    submissionId: cell.submissionId!,
                                    studentName: row.name,
                                    assignmentTitle: col.title,
                                  })
                                }
                                className={cn(
                                  "hover:bg-muted/80 flex w-full min-w-0 flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors",
                                  "cursor-pointer focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                                )}
                              >
                                <AssignmentCellVisual cell={cell} />
                              </button>
                            ) : (
                              <div
                                className="text-muted-foreground flex w-full min-w-0 cursor-not-allowed flex-col gap-1 rounded-md px-2 py-1.5 opacity-80"
                                aria-label="Нет сдачи для проверки"
                              >
                                <AssignmentCellVisual cell={cell} />
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

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

      <AssignmentReviewSheet
        isOpen={selectedAssignment != null}
        onOpenChange={(open) => {
          if (!open) setSelectedAssignment(null);
        }}
        submissionId={selectedAssignment?.submissionId ?? ""}
        studentName={selectedAssignment?.studentName ?? ""}
        assignmentTitle={selectedAssignment?.assignmentTitle ?? ""}
      />
    </>
  );
}
