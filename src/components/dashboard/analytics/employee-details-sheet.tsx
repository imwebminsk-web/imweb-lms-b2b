"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { getEmployeeTranscript } from "@/app/actions/analytics-actions";
import { cn } from "@/lib/utils";
import type {
  EmployeeAnalyticsRow,
  EmployeeTranscriptCourse,
  TranscriptJournalAssessment,
} from "@/types/analytics";

const STATUS_LABELS: Record<EmployeeTranscriptCourse["status"], string> = {
  completed: "Пройден",
  in_progress: "В процессе",
  not_started: "Не начинал",
};

const STATUS_VARIANTS: Record<
  EmployeeTranscriptCourse["status"],
  "default" | "secondary" | "outline"
> = {
  completed: "default",
  in_progress: "secondary",
  not_started: "outline",
};

function TranscriptSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function isAssessmentClickable(assessment: TranscriptJournalAssessment): boolean {
  if (assessment.type === "test") {
    return Boolean(assessment.testId) && (
      assessment.isPendingReview ||
      assessment.score !== null ||
      Boolean(assessment.attemptId)
    );
  }
  return Boolean(assessment.blockId) && assessment.assignmentStatus !== null;
}

function AssessmentScoreButton({
  assessment,
  onOpen,
}: {
  assessment: TranscriptJournalAssessment;
  onOpen: () => void;
}) {
  const clickable = isAssessmentClickable(assessment);

  if (assessment.isPendingReview) {
    if (!clickable) {
      return <Badge variant="secondary">На проверке</Badge>;
    }
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`${assessment.title}: на проверке, открыть разбор`}
      >
        <Badge variant="secondary">На проверке</Badge>
      </button>
    );
  }

  if (
    assessment.type === "assignment" &&
    assessment.assignmentStatus === "rejected"
  ) {
    if (!clickable) {
      return <span className="text-destructive text-xs">Откл.</span>;
    }
    return (
      <button
        type="button"
        onClick={onOpen}
        className="text-destructive text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`${assessment.title}: отклонено, открыть разбор`}
      >
        Откл.
      </button>
    );
  }

  if (assessment.score !== null) {
    const pass = assessment.score >= 50;
    const scoreClass = cn(
      "font-medium tabular-nums",
      pass
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400",
    );
    if (!clickable) {
      return <span className={scoreClass}>{assessment.score}</span>;
    }
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          scoreClass,
          "rounded-sm px-1 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
        aria-label={`${assessment.title}: ${assessment.score}, открыть разбор`}
      >
        {assessment.score}
      </button>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

export function EmployeeDetailsSheet({
  employee,
  isOpen,
  onClose,
}: {
  employee: EmployeeAnalyticsRow | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [transcript, setTranscript] = useState<EmployeeTranscriptCourse[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<{
    testId: string;
    title: string;
  } | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    blockId: string;
  } | null>(null);
  const transcriptRequestIdRef = useRef(0);

  const loadTranscript = useCallback((userId: string, silent = false) => {
    const requestId = ++transcriptRequestIdRef.current;
    if (!silent) {
      setIsLoading(true);
      setError(null);
      setTranscript(null);
    }

    getEmployeeTranscript(userId)
      .then((res) => {
        if (requestId !== transcriptRequestIdRef.current) return;

        if (res.success) {
          setTranscript(res.data);
          setError(null);
        } else {
          setError(res.error);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (requestId !== transcriptRequestIdRef.current) return;
        setError("Не удалось загрузить транскрипт.");
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!employee) return;
    loadTranscript(employee.id);
  }, [employee, loadTranscript]);

  function handleOpenAssessment(assessment: TranscriptJournalAssessment) {
    if (!isAssessmentClickable(assessment)) return;
    if (assessment.type === "test" && assessment.testId) {
      setSelectedTest({ testId: assessment.testId, title: assessment.title });
      return;
    }
    if (assessment.type === "assignment" && assessment.blockId) {
      setSelectedAssignment({ blockId: assessment.blockId });
    }
  }

  function handleReviewSheetClose(open: boolean) {
    if (open) return;
    setSelectedTest(null);
    setSelectedAssignment(null);
    if (employee) {
      loadTranscript(employee.id, true);
    }
  }

  return (
    <>
      <Sheet
        open={isOpen}
        modal={!selectedTest && !selectedAssignment}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTest(null);
            setSelectedAssignment(null);
            onClose();
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{employee?.fullName}</SheetTitle>
            <div className="text-sm text-muted-foreground">
              {employee?.team} • {employee?.jobTitle}
            </div>
          </SheetHeader>
          <div className="mt-6 px-4 pb-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Транскрипт курсов
            </h3>

            {isLoading && <TranscriptSkeleton />}

            {!isLoading && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {!isLoading && !error && transcript && transcript.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Нет назначенных курсов
              </p>
            )}

            {!isLoading && !error && transcript && transcript.length > 0 && (
              <div className="space-y-4">
                {transcript.map((course) => (
                  <Card key={course.courseId}>
                    <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                      <div className="font-medium leading-snug">
                        {course.courseTitle}
                      </div>
                      <Badge variant={STATUS_VARIANTS[course.status]}>
                        {STATUS_LABELS[course.status]}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Progress value={course.progress} />
                        <div className="text-xs text-muted-foreground">
                          {course.progress}%
                        </div>
                      </div>

                      {course.journalAssessments.length > 0 && (
                        <div className="space-y-1.5 border-t pt-3">
                          {course.journalAssessments.map((assessment, idx) => (
                            <div
                              key={`${course.courseId}-${assessment.type}-${assessment.testId ?? assessment.blockId ?? "na"}-${idx}`}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="text-muted-foreground min-w-0 truncate">
                                {assessment.title}
                              </span>
                              <AssessmentScoreButton
                                assessment={assessment}
                                onOpen={() => handleOpenAssessment(assessment)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TestResultSheet
        isOpen={selectedTest != null && employee != null}
        onOpenChange={handleReviewSheetClose}
        studentId={employee?.id ?? ""}
        testId={selectedTest?.testId ?? ""}
        studentName={employee?.fullName ?? ""}
        studentAvatarUrl={null}
        testTitle={selectedTest?.title ?? ""}
        isTeacher
      />

      {selectedAssignment && employee ? (
        <AssignmentReviewSheet
          isOpen
          onOpenChange={handleReviewSheetClose}
          fetchMode="lessonBlock"
          lessonBlockId={selectedAssignment.blockId}
          studentId={employee.id}
          studentName={employee.fullName}
          isTeacher
        />
      ) : null}
    </>
  );
}
