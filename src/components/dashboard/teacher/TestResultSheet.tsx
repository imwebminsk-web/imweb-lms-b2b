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
import { QuizResultView } from "@/components/quiz/QuizResultView";
import { GradingDisplay } from "@/components/quiz/GradingDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  /** Показать блок ручной корректировки балла (только для преподавателя). */
  isTeacher?: boolean;
};

export function TestResultSheet({
  isOpen,
  onOpenChange,
  studentId,
  testId,
  studentName,
  studentAvatarUrl = null,
  testTitle,
  isTeacher = false,
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto sm:gap-0"
        style={{ minWidth: "min(92vw, 1280px)" }}
      >
        <SheetHeader className="border-border shrink-0 border-b px-1 pb-4 text-left sm:px-2">
          <SheetTitle className="pr-8">{displayTitle}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-3 pt-1">
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
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
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

          {details?.attemptId &&
          details.resultSummary?.requiresManualReview &&
          isTeacher ? (
            <section className="border-amber-500/40 bg-amber-500/5 space-y-3 rounded-xl border-2 p-4">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Требуется ручная проверка развёрнутых ответов
              </p>
              <p className="text-muted-foreground text-sm">
                Откройте отдельную страницу проверки, чтобы выставить баллы и
                завершить оценку.
              </p>
              <Button asChild>
                <Link
                  href={`/dashboard/gradebook/attempts/${details.attemptId}/grade`}
                  onClick={() => onOpenChange(false)}
                >
                  Выставить баллы
                </Link>
              </Button>
            </section>
          ) : null}

          {details?.attemptId && details.resultSummary && reviewMaps != null ? (
            <>
              {details.gradingVisuals ? (
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                  {details.isForKids ? (
                    <GradingDisplay
                      score={details.score}
                      isForKids
                      totalPossiblePoints={details.totalPossiblePoints}
                      compact
                    />
                  ) : details.points !== null ? (
                    <Badge variant="outline">
                      Баллы: {details.points}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {isTeacher &&
              !details.isForKids &&
              !details.resultSummary.requiresManualReview ? (
                <section className="border-border space-y-3 rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">
                    Скорректировать баллы (0–100)
                  </h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="override-grade-100">Баллы</Label>
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveOverride}
                      disabled={isPending}
                    >
                      Сохранить
                    </Button>
                  </div>
                </section>
              ) : null}

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
                reviewAnswersByQuestionId={
                  reviewMaps.reviewAnswersByQuestionId
                }
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
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
