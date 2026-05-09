"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  getBestTestAttemptDetails,
  type GradebookBestAttemptDetails,
} from "@/app/actions/gradebook-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function isClassicChoice(type: string | null): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "multiple" ||
    type === "single"
  );
}

type TestResultSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  testId: string;
  studentName: string;
  testTitle: string;
};

export function TestResultSheet({
  isOpen,
  onOpenChange,
  studentId,
  testId,
  studentName,
  testTitle,
}: TestResultSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<GradebookBestAttemptDetails | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen || !studentId || !testId) {
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
  }, [isOpen, studentId, testId]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-border shrink-0 border-b pb-4 text-left">
          <SheetTitle className="pr-8">{testTitle}</SheetTitle>
          <SheetDescription>Ученик: {studentName}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 p-4">
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

          {details?.attemptId ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">
                Балл: {details.score ?? "—"} / {details.totalQuestions}
              </Badge>
              {details.percent != null ? (
                <Badge variant="outline">{details.percent}%</Badge>
              ) : null}
            </div>
          ) : null}

          {details?.questions.map((q, idx) => (
            <section
              key={q.questionId}
              className="border-border space-y-3 rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Вопрос {idx + 1}
                  {q.type ? ` · ${q.type}` : ""}
                </p>
                {q.questionCorrect === true ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  >
                    Верно
                  </Badge>
                ) : q.questionCorrect === false ? (
                  <Badge variant="destructive">Неверно</Badge>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed font-medium">{q.questionText}</p>

              {isClassicChoice(q.type) && q.options.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {q.options.map((opt) => {
                    const showCorrectMissed = opt.isCorrect && !opt.isPicked;
                    return (
                      <li
                        key={opt.id}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm",
                          opt.isPicked && opt.isCorrect &&
                            "border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
                          opt.isPicked && !opt.isCorrect &&
                            "border-destructive/50 bg-destructive/10 text-destructive",
                          !opt.isPicked && opt.isCorrect &&
                            "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-50",
                          !opt.isPicked && !opt.isCorrect &&
                            "border-border bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <span>{opt.label}</span>
                        {opt.isPicked && opt.isCorrect ? (
                          <span className="mt-1 block text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            Ваш ответ — верно
                          </span>
                        ) : null}
                        {opt.isPicked && !opt.isCorrect ? (
                          <span className="mt-1 block text-xs font-medium">
                            Ваш ответ — неверно
                          </span>
                        ) : null}
                        {showCorrectMissed ? (
                          <span className="mt-1 block text-xs font-medium text-amber-800 dark:text-amber-200">
                            Правильный вариант (не выбран)
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : q.nonChoiceAnswerSummary ? (
                <div className="bg-muted/40 rounded-md p-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                    Ответ (данные)
                  </p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {q.nonChoiceAnswerSummary}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Для этого типа вопроса детальный разбор в журнале пока упрощён.
                </p>
              )}
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
