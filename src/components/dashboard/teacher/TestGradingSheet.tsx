"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getAttemptGradingDetails,
  type AttemptGradingDetails,
} from "@/app/actions/grading-actions";
import {
  AttemptGradingQuestions,
  useAttemptGrading,
} from "@/components/dashboard/teacher/TeacherAttemptGradingView";
import { SendToRetakeDialog } from "@/components/dashboard/teacher/send-to-retake-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type TestGradingSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  attemptId: string | null;
};

export function TestGradingSheet({
  isOpen,
  onOpenChange,
  attemptId,
}: TestGradingSheetProps) {
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AttemptGradingDetails | null>(null);

  const grading = useAttemptGrading(data, () => {
    router.refresh();
    onOpenChange(false);
  });

  useEffect(() => {
    if (!isOpen || !attemptId) {
      setData(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setData(null);

    void (async () => {
      const res = await getAttemptGradingDetails(attemptId);
      if (cancelled) return;
      setIsLoading(false);
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      setData(res.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, attemptId]);

  const displayTitle = data?.testTitle?.trim() || "Проверка теста";
  const resultSummary = data?.resultSummary;

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
                  src={data?.studentAvatarUrl ?? undefined}
                  alt={data?.studentName ?? "Ученик"}
                />
                <AvatarFallback>
                  {initialsFromDisplayName(data?.studentName ?? "Ученик")}
                </AvatarFallback>
              </Avatar>
              <span>Ученик: {data?.studentName ?? "…"}</span>
              {data ? (
                grading.gradesSaved ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                  >
                    Проверено
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  >
                    На проверке
                  </Badge>
                )
              ) : null}
              {resultSummary ? (
                <span className="text-muted-foreground">
                  Автопроверка: {resultSummary.earnedPoints} /{" "}
                  {resultSummary.totalPossiblePoints} б.
                </span>
              ) : null}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span>Загрузка проверки…</span>
            </div>
          ) : null}

          {loadError ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          {!isLoading &&
          !loadError &&
          data &&
          data.attemptId &&
          resultSummary &&
          grading.reviewMaps ? (
            <AttemptGradingQuestions
              data={data}
              grades={grading.grades}
              isPending={grading.isPending}
              gradesSaved={grading.gradesSaved}
              reviewMaps={grading.reviewMaps}
              autoScoreByQuestionId={grading.autoScoreByQuestionId}
              targetsByQuestion={grading.targetsByQuestion}
              onGradeChange={grading.handleGradeChange}
            />
          ) : null}

          {!isLoading && !loadError && data && !data.attemptId ? (
            <Alert>
              <AlertTitle>Нет данных</AlertTitle>
              <AlertDescription>
                Не удалось загрузить попытку для проверки.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <SheetFooter className="mt-auto flex shrink-0 flex-col gap-4 border-t bg-background p-6 sm:flex-col sm:space-x-0">
          <div className="flex w-full justify-end gap-2">
            {data?.attemptId ? (
              <SendToRetakeDialog
                attemptId={data.attemptId}
                testId={data.testId}
                studentId={data.studentId}
                disabled={grading.isPending}
                triggerSize="lg"
                onSuccess={() => {
                  router.refresh();
                  onOpenChange(false);
                }}
              />
            ) : null}
            <Button
              type="button"
              size="lg"
              variant="default"
              onClick={grading.handleSubmit}
              disabled={
                !data ||
                grading.isPending ||
                grading.gradesSaved ||
                (data?.manualGradingTargets.length ?? 0) === 0
              }
            >
              {grading.isPending ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
                  Сохранение…
                </>
              ) : grading.gradesSaved ? (
                <>
                  <CheckCircle2Icon className="mr-2 size-4" aria-hidden />
                  Проверено
                </>
              ) : (
                "Сохранить баллы"
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
