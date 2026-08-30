"use client";

import { CheckSquare, FileText, Target } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { GradebookLegend } from "@/components/dashboard/gradebook/gradebook-legend";
import { JournalPointsDisplay } from "@/components/dashboard/gradebook/journal-points-display";
import { isGradebookDrawerOpenable } from "@/components/dashboard/gradebook/progress-status-visuals";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROW_ICON_CLASS =
  "text-muted-foreground mr-1.5 inline-block size-3 shrink-0";

function rowTypeIcon(item: StudentProgressItem) {
  if (item.type === "assignment") {
    return <FileText className={ROW_ICON_CLASS} aria-hidden />;
  }
  if (item.testType === "training") {
    return <Target className={ROW_ICON_CLASS} aria-hidden />;
  }
  return <CheckSquare className={ROW_ICON_CLASS} aria-hidden />;
}

function LessonTitle({
  item,
  onOpen,
}: {
  item: StudentProgressItem;
  onOpen: () => void;
}) {
  const canOpen =
    isGradebookDrawerOpenable(item.status, item.points) &&
    (item.type === "assignment"
      ? Boolean(item.lessonBlockId)
      : Boolean(item.testId));

  const label = (
    <>
      {rowTypeIcon(item)}
      {item.title}
    </>
  );

  if (!canOpen) {
    return (
      <span className="inline-flex max-w-full cursor-default items-center font-medium">
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "text-primary inline-flex max-w-full cursor-pointer items-center text-left font-medium hover:underline",
      )}
    >
      {label}
    </button>
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
    lessonId?: string;
  } | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    lessonBlockId: string;
  } | null>(null);
  const [showTraining, setShowTraining] = useState(false);

  const hasTrainingItems = items.some(
    (item) => item.type === "test" && item.testType === "training",
  );

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => showTraining || item.testType !== "training",
      ),
    [items, showTraining],
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Нажмите на название урока, чтобы открыть подробности.
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {hasTrainingItems ? (
            <>
              <Label
                htmlFor="student-progress-show-training"
                className="text-muted-foreground font-normal"
              >
                Показывать тренировки
              </Label>
              <Switch
                id="student-progress-show-training"
                checked={showTraining}
                onCheckedChange={setShowTraining}
                aria-label="Показывать тренировочные тесты"
              />
            </>
          ) : null}
          <GradebookLegend />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Урок / Задание</TableHead>
              <TableHead className="w-[100px]">Баллы</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  Пока нет тестов и заданий по этому курсу в успеваемости ученика.
                </TableCell>
              </TableRow>
            ) : visibleItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  Сейчас тренировочные тесты скрыты. Включите «Показывать
                  тренировки», чтобы увидеть их в журнале.
                </TableCell>
              </TableRow>
            ) : (
              visibleItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <LessonTitle
                      item={item}
                      onOpen={() => {
                        if (item.type === "assignment" && item.lessonBlockId) {
                          setSelectedAssignment({
                            lessonBlockId: item.lessonBlockId,
                          });
                          return;
                        }
                        if (item.testId) {
                          setSelectedTest({
                            studentId: viewedStudentId,
                            testId: item.testId,
                            studentName: viewedStudentName,
                            studentAvatarUrl: viewedStudentAvatarUrl,
                            testTitle: item.title,
                            lessonId: item.lessonId,
                          });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    <JournalPointsDisplay
                      points={item.points}
                      status={item.status}
                      compact
                    />
                  </TableCell>
                </TableRow>
              ))
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
          lessonBlockId={selectedAssignment.lessonBlockId}
          studentId={viewedStudentId}
          studentName={viewedStudentName}
          studentAvatarUrl={viewedStudentAvatarUrl}
          isTeacher
        />
      ) : null}
    </>
  );
}
