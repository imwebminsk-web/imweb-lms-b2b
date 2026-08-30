"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getBestTestAttemptDetails,
  overrideTestAttemptGrade,
  type GradebookBestAttemptDetails,
} from "@/app/actions/gradebook-actions";
import { SendToRetakeDialog } from "@/components/dashboard/teacher/send-to-retake-dialog";
import { QuizResultView } from "@/components/quiz/QuizResultView";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { buildGroupedCorrectByQuestionId, buildReviewMaps } from "@/lib/learn/build-review-maps";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type TestResultSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  testId: string;
  studentName: string;
  studentAvatarUrl?: string | null;
  testTitle: string;
  /** Урок из колонки журнала — чтобы сбросить completion только этого урока. */
  lessonId?: string;
  /** Показать блок ручной корректировки балла (только для преподавателя). */
  isTeacher?: boolean;
  /** Открыть проверку развёрнутых ответов в шторке, без перехода на отдельную страницу. */
  onOpenGrading?: (attemptId: string) => void;
};

export function TestResultSheet({
  isOpen,
  onOpenChange,
  studentId,
  testId,
  studentName,
  studentAvatarUrl = null,
  testTitle,
  lessonId,
  isTeacher = false,
  onOpenGrading,
}: TestResultSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<GradebookBestAttemptDetails | null>(
    null,
  );
  const [overrideGrade, setOverrideGrade] = useState("");

  const reviewMaps = useMemo(() => {
    if (!details?.attemptId || !details.resultSummary) return null;
    return buildReviewMaps(
      details.reviewAnswers,
      details.questions,
      buildGroupedCorrectByQuestionId(details.questions),
    );
  }, [details]);

  const loadDetails = useCallback(() => {
    if (!studentId || !testId) {
      setDetails(null);
      setError(null);
      return;
    }
    setError(null);
    setDetails(null);
    startTransition(() => {
      void (async () => {
        const res = await getBestTestAttemptDetails(studentId, testId);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setDetails(res.data);
      })();
    });
  }, [studentId, testId]);

  useEffect(() => {
    if (!isOpen || !studentId || !testId) {
      setDetails(null);
      setError(null);
      setOverrideGrade("");
      return;
    }
    loadDetails();
  }, [isOpen, studentId, testId, loadDetails]);

  useEffect(() => {
    if (details?.points !== null && details?.points !== undefined) {
      setOverrideGrade(String(details.points));
    } else {
      setOverrideGrade("");
    }
  }, [details?.attemptId, details?.points]);

  function handleSaveOverride() {
    if (!details?.attemptId) return;
    const n = Number(overrideGrade);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
      toast.error("Введите целое число от 0 до 100");
      return;
    }
    startTransition(() => {
      void (async () => {
        const res = await overrideTestAttemptGrade(details.attemptId!, n);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success("Баллы обновлены");
        router.refresh();
        const again = await getBestTestAttemptDetails(studentId, testId);
        if (!again.success) {
          setError(again.error);
          return;
        }
        setDetails(again.data);
      })();
    });
  }

  const displayTitle = details?.testTitle?.trim() || testTitle;

  const retakeButton =
    isTeacher && details?.attemptId ? (
      <SendToRetakeDialog
        attemptId={details.attemptId}
        testId={testId}
        studentId={studentId}
        lessonId={lessonId}
        disabled={isPending}
        onSuccess={() => {
          router.refresh();
          onOpenChange(false);
        }}
      />
    ) : null;

  const showOverride =
    Boolean(
      isTeacher &&
        details?.attemptId &&
        details.resultSummary &&
        !details.resultSummary.requiresManualReview,
    );
  const showManualReviewCta =
    Boolean(
      details?.attemptId &&
        details.resultSummary?.requiresManualReview &&
        isTeacher,
    );
  const showFooter = showOverride || showManualReviewCta || Boolean(retakeButton);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 p-0 !w-[95vw] !max-w-full sm:!w-[90vw] sm:!max-w-[1100px]"
      >
        <SheetHeader className="shrink-0 border-b p-6 text-left">
          <SheetTitle className="pr-8">{displayTitle}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={studentAvatarUrl ?? undefined}
                  alt={studentName}
                />
                <AvatarFallback>
                  {initialsFromDisplayName(studentName)}
                </AvatarFallback>
              </Avatar>
              <span>Ученик: {studentName}</span>
              {showManualReviewCta ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                >
                  На проверке
                </Badge>
              ) : null}
              {details?.points != null ? (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                >
                  Баллы: {details.points}
                </Badge>
              ) : null}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isPending && !error && details === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span>Загрузка результатов…</span>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!isPending && !error && details && !details.attemptId ? (
            <Alert>
              <AlertTitle>Нет данных</AlertTitle>
              <AlertDescription>
                У этого ученика нет завершённых попыток по этому тесту.
              </AlertDescription>
            </Alert>
          ) : null}

          {showManualReviewCta ? (
            <section className="mb-6 space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Требуется ручная проверка развёрнутых ответов
              </p>
              <p className="text-muted-foreground text-sm">
                Нажмите «Выставить баллы» внизу, чтобы открыть панель проверки.
              </p>
            </section>
          ) : null}

          {details?.attemptId && details.resultSummary && reviewMaps != null ? (
            <QuizResultView
              showTestMeta
              testTitle={displayTitle}
              testDescription={details.testDescription}
              questions={details.questions}
              result={details.resultSummary}
              reviewRowsByQuestionId={reviewMaps.reviewRowsByQuestionId}
              reviewCorrectIdsByQuestionId={
                reviewMaps.reviewCorrectIdsByQuestionId
              }
              reviewFillByQuestionId={reviewMaps.reviewFillByQuestionId}
              reviewAnswersByQuestionId={reviewMaps.reviewAnswersByQuestionId}
              reviewGroupedSelectionsByQuestionId={
                reviewMaps.reviewGroupedSelectionsByQuestionId
              }
              reviewGroupedCorrectByQuestionId={
                reviewMaps.reviewGroupedCorrectByQuestionId
              }
              reviewGroupedFillTypingByQuestionId={
                reviewMaps.reviewGroupedFillTypingByQuestionId
              }
              reviewGroupedFillAssignmentsByQuestionId={
                reviewMaps.reviewGroupedFillAssignmentsByQuestionId
              }
              reviewOrderingAssignmentsByQuestionId={
                reviewMaps.reviewOrderingAssignmentsByQuestionId
              }
            />
          ) : null}
        </div>

        {showFooter ? (
          <SheetFooter className="mt-auto flex shrink-0 flex-col gap-4 border-t bg-background p-6 sm:flex-col sm:space-x-0">
            {showOverride ? (
              <div className="w-full space-y-2">
                <Label htmlFor="override-grade-100">Баллы:</Label>
                <Input
                  id="override-grade-100"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  className="w-24"
                  value={overrideGrade}
                  onChange={(e) => setOverrideGrade(e.target.value)}
                  disabled={isPending}
                />
              </div>
            ) : null}
            <div className="flex w-full justify-end gap-2">
              {retakeButton}
              {showOverride ? (
                <Button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={isPending}
                >
                  Сохранить
                </Button>
              ) : null}
              {showManualReviewCta && details?.attemptId ? (
                onOpenGrading ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const id = details.attemptId;
                      if (!id) return;
                      onOpenChange(false);
                      onOpenGrading(id);
                    }}
                  >
                    Выставить баллы
                  </Button>
                ) : (
                  <Button asChild>
                    <Link
                      href={`/dashboard/gradebook/attempts/${details.attemptId}/grade`}
                      onClick={() => onOpenChange(false)}
                    >
                      Выставить баллы
                    </Link>
                  </Button>
                )
              ) : null}
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
