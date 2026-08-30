"use client";

import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { AttemptGradingDetails } from "@/app/actions/grading-actions";
import { submitManualGrades } from "@/app/actions/grading-actions";
import type { ManualGradingTarget } from "@/app/actions/gradebook-actions";
import { SendToRetakeDialog } from "@/components/dashboard/teacher/send-to-retake-dialog";
import { QuizResultView } from "@/components/quiz/QuizResultView";
import { QuizTaskInstruction } from "@/components/quiz/QuizTaskInstruction";
import { GroupedFillBlanksTaskQuestion } from "@/components/quiz/GroupedFillBlanksTaskQuestion";
import { parseTaskPresentation } from "@/lib/utils/task-content";
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
import type { Json } from "@/types/database.types";

type TeacherAttemptGradingViewProps = {
  data: AttemptGradingDetails;
  returnTo?: string | null;
};

function resolvePostGradeRedirectUrl(
  returnTo: string | null | undefined,
  cohortId: string | null,
): string {
  if (returnTo?.startsWith("/dashboard/")) {
    return returnTo;
  }
  if (cohortId) {
    return `/dashboard/cohorts/${cohortId}?tab=journal`;
  }
  return "/dashboard/cohorts";
}

function initGrades(targets: ManualGradingTarget[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of targets) {
    out[t.itemId] = "";
  }
  return out;
}

function questionInstructionFallback(q: { type: string | null }): string {
  if (q.type === "text_input") {
    return "Развёрнутый ответ";
  }
  return "Вопрос";
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

export function useAttemptGrading(
  data: AttemptGradingDetails | null,
  onSuccess: (cohortId: string | null) => void,
) {
  const [isPending, startTransition] = useTransition();
  const [gradesSaved, setGradesSaved] = useState(false);
  const [grades, setGrades] = useState<Record<string, string>>(() =>
    initGrades(data?.manualGradingTargets ?? []),
  );

  const reviewMaps = useMemo(
    () =>
      data
        ? buildReviewMaps(
            data.reviewAnswers,
            data.questions,
            buildGroupedCorrectByQuestionId(data.questions),
          )
        : null,
    [data],
  );

  const autoScoreByQuestionId = useMemo(() => {
    const map = new Map<string, { earned: number; max: number }>();
    if (!data) return map;
    for (const row of data.autoGradedScores) {
      map.set(row.questionId, {
        earned: row.earnedPoints,
        max: row.maxPoints,
      });
    }
    return map;
  }, [data]);

  const targetsByQuestion = useMemo(() => {
    const map = new Map<string, ManualGradingTarget[]>();
    if (!data) return map;
    for (const t of data.manualGradingTargets) {
      const list = map.get(t.questionId) ?? [];
      list.push(t);
      map.set(t.questionId, list);
    }
    return map;
  }, [data]);

  function handleGradeChange(itemId: string, raw: string) {
    setGrades((prev) => ({ ...prev, [itemId]: raw }));
  }

  useEffect(() => {
    if (!data) {
      setGrades({});
      setGradesSaved(false);
      return;
    }
    setGrades(initGrades(data.manualGradingTargets));
    setGradesSaved(false);
  }, [data]);

  function handleSubmit() {
    if (!data) return;
    const parsedGrades: Record<string, number> = {};
    for (const t of data.manualGradingTargets) {
      const raw = (grades[t.itemId] ?? "").trim();
      const value = Number(raw);
      if (
        raw === "" ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < 0
      ) {
        toast.error("Пожалуйста, выставьте баллы за все ответы.");
        return;
      }
      if (value > t.maxPoints) {
        toast.error(
          `Балл для подзадания ${t.itemIndex + 1} должен быть от 0 до ${t.maxPoints}`,
        );
        return;
      }
      parsedGrades[t.itemId] = value;
    }

    if (!data.attemptId) return;

    startTransition(() => {
      void (async () => {
        const res = await submitManualGrades(data.attemptId!, parsedGrades);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setGradesSaved(true);
        toast.success(`Баллы сохранены. Итог: ${res.percentScore}%`);
        onSuccess(res.cohortId);
      })();
    });
  }

  return {
    isPending,
    gradesSaved,
    grades,
    reviewMaps,
    autoScoreByQuestionId,
    targetsByQuestion,
    handleGradeChange,
    handleSubmit,
  };
}

export function AttemptGradingQuestions({
  data,
  grades,
  isPending,
  gradesSaved,
  reviewMaps,
  autoScoreByQuestionId,
  targetsByQuestion,
  onGradeChange,
}: {
  data: AttemptGradingDetails;
  grades: Record<string, string>;
  isPending: boolean;
  gradesSaved: boolean;
  reviewMaps: ReturnType<typeof buildReviewMaps>;
  autoScoreByQuestionId: Map<string, { earned: number; max: number }>;
  targetsByQuestion: Map<string, ManualGradingTarget[]>;
  onGradeChange: (itemId: string, raw: string) => void;
}) {
  const resultSummary = data.resultSummary;
  if (!resultSummary) return null;

  return (
    <div className="flex flex-col">
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
              className="mb-6 min-w-0 space-y-4 border-b border-amber-500/30 pb-6 last:mb-0 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Задание {index + 1} ·{" "}
                    {questionTypeLabel(q.type ?? "text_input")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Требует ручной проверки — выставьте баллы ниже
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                >
                  Ожидает оценки
                </Badge>
              </div>

              <QuizTaskInstruction
                task={parseTaskPresentation(
                  q.content as Json,
                  q.media_play_limit ?? 0,
                )}
                fallbackTitle={questionInstructionFallback(q)}
                variant="section"
                isReviewMode
              />

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

              <div className="space-y-4 pt-1">
                {questionTargets.map((target) => (
                  <div
                    key={target.itemId}
                    className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
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
                      <Label
                        htmlFor={`grade-${target.itemId}`}
                        className="sr-only"
                      >
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
                        value={grades[target.itemId] ?? ""}
                        onChange={(e) =>
                          onGradeChange(target.itemId, e.target.value)
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
            className="mb-6 min-w-0 space-y-3 border-b pb-6 opacity-95 last:mb-0 last:border-b-0 last:pb-0"
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
                <Badge variant="outline" className="text-xs">
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
  );
}

export function TeacherAttemptGradingView({
  data,
  returnTo = null,
}: TeacherAttemptGradingViewProps) {
  const router = useRouter();
  const grading = useAttemptGrading(data, (cohortId) => {
    router.push(resolvePostGradeRedirectUrl(returnTo, cohortId));
  });

  const displayTitle = data.testTitle?.trim() || "Проверка теста";
  const resultSummary = data.resultSummary;

  if (!data.attemptId || !resultSummary || !grading.reviewMaps) {
    return (
      <p className="text-muted-foreground text-sm">
        Нет данных для проверки этой попытки.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="link" size="sm" asChild>
          <Link href="/dashboard/cohorts">
            <ArrowLeftIcon className="mr-1 size-4" aria-hidden />
            К группам
          </Link>
        </Button>
      </div>

      <header className="min-w-0 space-y-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle}</h1>
          {grading.gradesSaved ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
            >
              <CheckCircle2Icon className="mr-1 size-3" aria-hidden />
              Проверено
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            >
              На проверке
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Ученик:{" "}
          <span className="text-foreground font-medium">{data.studentName}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Автопроверка (предварительно):{" "}
          <span className="text-foreground tabular-nums font-medium">
            {resultSummary.earnedPoints} / {resultSummary.totalPossiblePoints} б.
          </span>
        </p>
      </header>

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

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-4 border-t px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            size="lg"
            variant="default"
            className="w-full sm:w-auto"
            onClick={grading.handleSubmit}
            disabled={
              grading.isPending ||
              grading.gradesSaved ||
              data.manualGradingTargets.length === 0
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
          {data.attemptId ? (
            <SendToRetakeDialog
              attemptId={data.attemptId}
              testId={data.testId}
              studentId={data.studentId}
              disabled={grading.isPending}
              triggerSize="lg"
              triggerClassName="min-h-11 w-full sm:w-auto"
              onSuccess={() => {
                router.push("/dashboard");
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
