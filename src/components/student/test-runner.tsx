"use client";

import { startTestAttempt, submitTestAttempt } from "@/app/actions/attempt-actions";
import {
  getSafeTestForClient,
  type SafeTestForClientPayload,
} from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Json } from "@/types/database.types";
import { useMemo, useState } from "react";

type RunnerState = "idle" | "loading" | "in_progress" | "submitting" | "completed";

type AnswerDraft = {
  option_ids: string[];
  answer_data?: unknown;
};

function readTextFromJsonContent(value: Json): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (typeof rec.text === "string") {
      return rec.text;
    }
  }
  return "";
}

export function TestRunner({ testId }: { testId: string }) {
  const [state, setState] = useState<RunnerState>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [testData, setTestData] = useState<SafeTestForClientPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const totalQuestions = testData?.questions.length ?? 0;
  const answeredQuestions = useMemo(
    () =>
      Object.values(answers).filter((a) => Array.isArray(a.option_ids) && a.option_ids.length > 0)
        .length,
    [answers],
  );

  async function handleStart() {
    setState("loading");
    setError(null);

    const [attemptResult, testResult] = await Promise.all([
      startTestAttempt(testId),
      getSafeTestForClient(testId),
    ]);

    if (!attemptResult.success) {
      setError(attemptResult.error);
      setState("idle");
      return;
    }

    if (!testResult.success) {
      setError(testResult.error);
      setState("idle");
      return;
    }

    setAttemptId(attemptResult.attemptId);
    setTestData(testResult.data);
    setAnswers({});
    setScore(null);
    setState("in_progress");
  }

  function setSingleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { option_ids: [optionId] },
    }));
  }

  function toggleMultipleChoice(questionId: string, optionId: string, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId]?.option_ids ?? [];
      const nextIds = checked
        ? [...new Set([...current, optionId])]
        : current.filter((id) => id !== optionId);
      return {
        ...prev,
        [questionId]: { option_ids: nextIds },
      };
    });
  }

  async function handleSubmit() {
    if (!attemptId || !testData) {
      setError("Не удалось отправить попытку: отсутствуют данные теста.");
      return;
    }

    setState("submitting");
    setError(null);

    const payload = testData.questions.map((q) => ({
      question_id: q.id,
      option_ids: answers[q.id]?.option_ids ?? [],
      answer_data: answers[q.id]?.answer_data ?? null,
    }));

    const result = await submitTestAttempt(attemptId, payload);
    if (!result.success) {
      setError(result.error);
      setState("in_progress");
      return;
    }

    setScore(result.score);
    setState("completed");
  }

  if (state === "idle" || state === "loading") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Тест</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Нажмите кнопку ниже, чтобы начать прохождение.
          </p>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button onClick={handleStart} disabled={state === "loading"}>
            {state === "loading" ? "Загрузка..." : "Start Test"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "completed") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Тест завершен</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold">Ваш результат: {score ?? 0}%</p>
          <p className="text-muted-foreground text-sm">Спасибо за прохождение теста.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{testData?.title ?? "Тест"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {testData?.description ? (
            <p className="text-muted-foreground text-sm">{testData.description}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Отвечено: {answeredQuestions}/{totalQuestions}
          </p>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </CardContent>
      </Card>

      {testData?.questions.map((question, index) => {
        const selected = answers[question.id]?.option_ids ?? [];
        const questionText = readTextFromJsonContent(question.content);
        const isSingle = question.type === "single_choice";
        const isMultiple = question.type === "multiple_choice";

        return (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-base">
                Вопрос {index + 1}
                {questionText ? `: ${questionText}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSingle ? (
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const optionText = readTextFromJsonContent(option.content);
                    const inputId = `${question.id}-${option.id}`;
                    return (
                      <label key={option.id} htmlFor={inputId} className="flex items-center gap-2 text-sm">
                        <input
                          id={inputId}
                          type="radio"
                          name={`q-${question.id}`}
                          checked={selected.includes(option.id)}
                          onChange={() => setSingleChoice(question.id, option.id)}
                          className="size-4"
                        />
                        <span>{optionText || "Вариант без текста"}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {isMultiple ? (
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const optionText = readTextFromJsonContent(option.content);
                    const inputId = `${question.id}-${option.id}`;
                    return (
                      <div key={option.id} className="flex items-center gap-2">
                        <Checkbox
                          id={inputId}
                          checked={selected.includes(option.id)}
                          onCheckedChange={(checked) =>
                            toggleMultipleChoice(question.id, option.id, checked === true)
                          }
                        />
                        <Label htmlFor={inputId}>{optionText || "Вариант без текста"}</Label>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!isSingle && !isMultiple ? (
                <p className="text-muted-foreground text-sm">
                  Этот тип вопроса пока отображается как заглушка. Поддержка будет добавлена на следующем этапе.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <div className="pb-4">
        <Button onClick={handleSubmit} disabled={state === "submitting"}>
          {state === "submitting" ? "Отправка..." : "Submit Test"}
        </Button>
      </div>
    </div>
  );
}
