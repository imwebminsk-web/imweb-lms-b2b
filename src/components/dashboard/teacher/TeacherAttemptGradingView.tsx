"use client";

import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { AttemptGradingDetails } from "@/app/actions/grading-actions";
import { submitManualGrades } from "@/app/actions/grading-actions";
import type { ManualGradingTarget } from "@/app/actions/gradebook-actions";
import { QuizResultView } from "@/components/quiz/QuizResultView";
import { GroupedFillBlanksTaskQuestion } from "@/components/quiz/GroupedFillBlanksTaskQuestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildGroupedCorrectByQuestionId,
  buildReviewMaps,
} from "@/lib/learn/build-review-maps";
import {
  resolveGroupedFillBlanksPlayerView,
  resolveReviewGroupedFillTypingForPlayer,
} from "@/lib/grouped-fill-blanks-utils";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.types";

type TeacherAttemptGradingViewProps = {
  data: AttemptGradingDetails;
};

function initGrades(targets: ManualGradingTarget[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of targets) {
    out[t.itemId] = 0;
  }
  return out;
}

function questionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text_input: "Развёрнутый ответ",
    single_choice: "Один из многих",
    multiple_choice: "Несколько из многих",
    multiple: "Несколько из многих",
    ordering: "Упорядочивание",
    fill_in_the_blanks: "Пропуски",
    fill_in_the_blanks_multi: "Пропуски (несколько)",
    fill_blanks_typing: "Ввод пропусков",
    fill_blanks_typing_multi: "Ввод пропусков (несколько)",
    matching_puzzle: "Соответствие",
    dnd_puzzle: "Перетаскивание",
    image_labeling: "Подписи к изображениям",
  };
  return labels[type] ?? type;
}

export function TeacherAttemptGradingView({ data }: TeacherAttemptGradingViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [gradesSaved, setGradesSaved] = useState(false);
  const [grades, setGrades] = useState<Record<string, number>>(() =>
    initGrades(data.manualGradingTargets),
  );

  const reviewMaps = useMemo(
    () =>
      buildReviewMaps(
        data.reviewAnswers,
        data.questions,
        buildGroupedCorrectByQuestionId(data.questions),
      ),
    [data.reviewAnswers, data.questions],
  );

  const autoScoreByQuestionId = useMemo(() => {
    const map = new Map<string, { earned: number; max: number }>();
    for (const row of data.autoGradedScores) {
      map.set(row.questionId, {
        earned: row.earnedPoints,
        max: row.maxPoints,
      });
    }
    return map;
  }, [data.autoGradedScores]);

  const targetsByQuestion = useMemo(() => {
    const map = new Map<string, ManualGradingTarget[]>();
    for (const t of data.manualGradingTargets) {
      const list = map.get(t.questionId) ?? [];
      list.push(t);
      map.set(t.questionId, list);
    }
    return map;
  }, [data.manualGradingTargets]);

  function handleGradeChange(itemId: string, raw: string, maxPoints: number) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setGrades((prev) => ({ ...prev, [itemId]: 0 }));
      return;
    }
    const clamped = Math.max(0, Math.min(maxPoints, Math.round(parsed)));
    setGrades((prev) => ({ ...prev, [itemId]: clamped }));
  }

  function handleSubmit() {
    for (const t of data.manualGradingTargets) {
      const value = grades[t.itemId] ?? 0;
      if (value < 0 || value > t.maxPoints) {
        toast.error(
          `Балл для подзадания ${t.itemIndex + 1} должен быть от 0 до ${t.maxPoints}`,
        );
        return;
      }
    }

    if (!data.attemptId) return;

    startTransition(() => {
      void (async () => {
        const res = await submitManualGrades(data.attemptId!, grades);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setGradesSaved(true);
        toast.success(`Баллы сохранены. Итог: ${res.percentScore}%`);
        router.refresh();
        window.setTimeout(() => {
          router.push("/dashboard/cohorts");
        }, 1400);
      })();
    });
  }

  const displayTitle = data.testTitle?.trim() || "Проверка теста";
  const resultSummary = data.resultSummary;

  if (!data.attemptId || !resultSummary) {
    return (
      <p className="text-muted-foreground text-sm">
        Нет данных для проверки этой попытки.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 min-h-11 sm:min-h-9">
          <Link href="/dashboard/cohorts">
            <ArrowLeftIcon className="mr-1 size-4" aria-hidden />
            К группам
          </Link>
        </Button>
      </div>

      <header className="min-w-0 space-y-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle}</h1>
          {gradesSaved ? (
            <Badge className="border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2Icon className="mr-1 size-3" aria-hidden />
              Проверено
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            >
              На проверке
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Ученик: <span className="text-foreground font-medium">{data.studentName}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Автопроверка (предварительно):{" "}
          <span className="text-foreground tabular-nums font-medium">
            {resultSummary.earnedPoints} / {resultSummary.totalPossiblePoints} б.
          </span>
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {data.questions.map((q, index) => {
          const isManual = q.type === "text_input";
          const autoScore = autoScoreByQuestionId.get(q.id);
          const questionTargets = targetsByQuestion.get(q.id) ?? [];

          if (isManual) {
            const view = resolveGroupedFillBlanksPlayerView({
              content: q.content as Json,
              questionType: q.type,
            });
            const savedTyping = view
              ? resolveReviewGroupedFillTypingForPlayer({
                  rows: reviewMaps.reviewRowsByQuestionId.get(q.id) ?? [],
                  fromMap:
                    reviewMaps.reviewGroupedFillTypingByQuestionId.get(q.id),
                  items: view.items,
                })
              : {};

            return (
              <section
                key={q.id}
                className="border-amber-500/50 bg-amber-500/5 min-w-0 space-y-4 rounded-xl border-2 p-4 sm:p-6"
              >
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      Задание {index + 1} · {questionTypeLabel(q.type ?? "text_input")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Требует ручной проверки — выставьте баллы ниже
                    </p>
                  </div>
                  <Badge className="bg-amber-600 hover:bg-amber-600">
                    Ожидает оценки
                  </Badge>
                </div>

                {view ? (
                  <div className="min-w-0 w-full max-w-none overflow-x-hidden">
                    <GroupedFillBlanksTaskQuestion
                    items={view.items}
                    mode={view.mode}
                    groupedTyping={savedTyping}
                    isReviewMode
                    reviewRawAnswer={
                      (reviewMaps.reviewRowsByQuestionId.get(q.id) ?? []).find(
                        (row) => row.answer_data != null,
                      )?.answer_data ?? null
                    }
                  />
                  </div>
                ) : null}

                <div className="space-y-4 border-t border-amber-500/20 pt-4">
                  {questionTargets.map((target) => (
                    <div
                      key={target.itemId}
                      className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-background p-3 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`grade-${target.itemId}`}>
                          Баллы за подзадание {target.itemIndex + 1}
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          Максимум: {target.maxPoints} б.
                        </p>
                      </div>
                      <div className="w-full space-y-1 sm:w-auto">
                        <Label htmlFor={`grade-${target.itemId}`} className="sr-only">
                          Баллы
                        </Label>
                        <Input
                          id={`grade-${target.itemId}`}
                          type="number"
                          min={0}
                          max={target.maxPoints}
                          step={1}
                          inputMode="numeric"
                          className="h-11 w-full border-amber-500/40 focus-visible:ring-amber-500/50 sm:w-28"
                          value={grades[target.itemId] ?? 0}
                          onChange={(e) =>
                            handleGradeChange(
                              target.itemId,
                              e.target.value,
                              target.maxPoints,
                            )
                          }
                          disabled={isPending || gradesSaved}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          return (
            <section
              key={q.id}
              className={cn(
                "min-w-0 space-y-3 rounded-xl border p-4 sm:p-6",
                "border-muted bg-muted/20 opacity-95",
              )}
            >
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <LockIcon
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                  <p className="text-muted-foreground text-sm font-medium">
                    Задание {index + 1} · {questionTypeLabel(q.type ?? "")}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    Автопроверка
                  </Badge>
                </div>
                {autoScore ? (
                  <p className="text-muted-foreground text-sm tabular-nums">
                    <span className="text-foreground font-semibold">
                      {autoScore.earned}
                    </span>
                    {" / "}
                    {autoScore.max} б.
                  </p>
                ) : null}
              </div>

              <div className="pointer-events-none min-w-0 w-full select-none overflow-x-hidden opacity-90">
                <QuizResultView
                  reviewOnly
                  questionIndexOffset={index}
                  questions={[q]}
                  result={resultSummary}
                  reviewRowsByQuestionId={reviewMaps.reviewRowsByQuestionId}
                  reviewCorrectIdsByQuestionId={
                    reviewMaps.reviewCorrectIdsByQuestionId
                  }
                  reviewFillByQuestionId={reviewMaps.reviewFillByQuestionId}
                  reviewGroupedFillTypingByQuestionId={
                    reviewMaps.reviewGroupedFillTypingByQuestionId
                  }
                  reviewGroupedFillAssignmentsByQuestionId={
                    reviewMaps.reviewGroupedFillAssignmentsByQuestionId
                  }
                  reviewAnswersByQuestionId={reviewMaps.reviewAnswersByQuestionId}
                  reviewGroupedSelectionsByQuestionId={
                    reviewMaps.reviewGroupedSelectionsByQuestionId
                  }
                  reviewGroupedCorrectByQuestionId={
                    reviewMaps.reviewGroupedCorrectByQuestionId
                  }
                  reviewOrderingAssignmentsByQuestionId={
                    reviewMaps.reviewOrderingAssignmentsByQuestionId
                  }
                />
              </div>
            </section>
          );
        })}
      </div>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-4 border-t px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Button
          type="button"
          size="lg"
          className={cn(
            "min-h-11 w-full sm:w-auto",
            gradesSaved &&
              "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600",
          )}
          onClick={handleSubmit}
          disabled={
            isPending || gradesSaved || data.manualGradingTargets.length === 0
          }
        >
          {isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
              Сохранение…
            </>
          ) : gradesSaved ? (
            <>
              <CheckCircle2Icon className="mr-2 size-4" aria-hidden />
              Проверено
            </>
          ) : (
            "Сохранить баллы"
          )}
        </Button>
      </div>
    </div>
  );
}
