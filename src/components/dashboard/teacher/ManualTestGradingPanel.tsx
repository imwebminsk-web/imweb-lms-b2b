"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitManualGrades } from "@/app/actions/grading-actions";
import type {
  AutoGradedQuestionScore,
  ManualGradingTarget,
} from "@/app/actions/gradebook-actions";
import { GroupedFillBlanksTaskQuestion } from "@/components/quiz/GroupedFillBlanksTaskQuestion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveGroupedFillBlanksPlayerView } from "@/lib/grouped-fill-blanks-utils";
import { cn } from "@/lib/utils";
import type { SafeTestQuestion } from "@/app/actions/test-actions";
import type { Json } from "@/types/database.types";

type ManualTestGradingPanelProps = {
  attemptId: string;
  targets: ManualGradingTarget[];
  autoGradedScores: AutoGradedQuestionScore[];
  questions: SafeTestQuestion[];
  reviewGroupedFillTypingByQuestionId: Map<
    string,
    Record<string, Record<string, string>>
  >;
  onCompleted: () => void;
};

function initGrades(targets: ManualGradingTarget[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of targets) {
    out[t.itemId] = 0;
  }
  return out;
}

export function ManualTestGradingPanel({
  attemptId,
  targets,
  autoGradedScores,
  questions,
  reviewGroupedFillTypingByQuestionId,
  onCompleted,
}: ManualTestGradingPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [gradesSaved, setGradesSaved] = useState(false);
  const [grades, setGrades] = useState<Record<string, number>>(() =>
    initGrades(targets),
  );

  const targetsByQuestion = useMemo(() => {
    const map = new Map<string, ManualGradingTarget[]>();
    for (const t of targets) {
      const list = map.get(t.questionId) ?? [];
      list.push(t);
      map.set(t.questionId, list);
    }
    return map;
  }, [targets]);

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
    for (const t of targets) {
      const value = grades[t.itemId] ?? 0;
      if (value < 0 || value > t.maxPoints) {
        toast.error(
          `Балл за подзадание ${t.itemIndex + 1} должен быть от 0 до ${t.maxPoints}`,
        );
        return;
      }
    }

    startTransition(() => {
      void (async () => {
        const res = await submitManualGrades(attemptId, grades);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setGradesSaved(true);
        toast.success(`Баллы сохранены. Итог: ${res.percentScore}%`);
        window.setTimeout(() => {
          onCompleted();
        }, 1200);
      })();
    });
  }

  if (targets.length === 0) {
    return null;
  }

  return (
    <section className="border-primary/30 bg-primary/5 space-y-6 rounded-xl border-2 p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Ручная проверка</h3>
        <p className="text-muted-foreground text-sm">
          Выставьте баллы за развёрнутые ответы. Автоматически проверенные
          задания уже учтены в предварительном счёте.
        </p>
      </div>

      {autoGradedScores.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Автопроверка (только просмотр)</p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {autoGradedScores.map((row) => (
              <li key={row.questionId} className="flex justify-between gap-4">
                <span>
                  Вопрос {row.questionIndex + 1} ({row.type})
                </span>
                <span className="text-foreground tabular-nums font-medium">
                  {row.earnedPoints} / {row.maxPoints} б.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-8">
        {[...targetsByQuestion.entries()].map(([questionId, questionTargets]) => {
          const question = questions.find((q) => q.id === questionId);
          if (!question) return null;

          const view = resolveGroupedFillBlanksPlayerView({
            content: question.content as Json,
            questionType: question.type,
          });
          const savedTyping =
            reviewGroupedFillTypingByQuestionId.get(questionId) ?? {};

          return (
            <div key={questionId} className="space-y-4 rounded-lg border bg-background p-4">
              <p className="font-medium">
                Вопрос {questionTargets[0].questionIndex + 1}: развёрнутый ответ
              </p>

              {view ? (
                <div className="w-full max-w-none">
                  <GroupedFillBlanksTaskQuestion
                    items={view.items}
                    mode={view.mode}
                    groupedTyping={savedTyping}
                    isReviewMode
                  />
                </div>
              ) : null}

              <div className="space-y-4">
                {questionTargets.map((target) => (
                  <div
                    key={target.itemId}
                    className="flex flex-wrap items-end gap-3 border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor={`grade-${target.itemId}`}>
                        Баллы за подзадание {target.itemIndex + 1}
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Максимум: {target.maxPoints} б.
                      </p>
                    </div>
                    <div className="space-y-1">
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
                        className="w-24"
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
            </div>
          );
        })}
      </div>

      <div className="bg-background/80 sticky bottom-0 -mx-4 border-t px-4 py-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          size="lg"
          className={cn(
            "w-full sm:w-auto",
            gradesSaved &&
              "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600",
          )}
          onClick={handleSubmit}
          disabled={isPending || gradesSaved}
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
    </section>
  );
}
