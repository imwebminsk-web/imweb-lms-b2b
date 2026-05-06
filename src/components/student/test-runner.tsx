"use client";

import { startTestAttempt, submitTestAttempt } from "@/app/actions/attempt-actions";
import {
  getSafeTestForClient,
  type SafeTestForClientPayload,
} from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/types/database.types";
import { useMemo, useState } from "react";
import { ImageIcon, Link2, PenLine } from "lucide-react";

type RunnerState = "idle" | "loading" | "in_progress" | "submitting" | "completed";

type AnswerDraft = {
  option_ids: string[];
  answer_data?: unknown;
};

type JsonRecord = Record<string, unknown>;

type FillSegment = { type: "text"; value: string } | { type: "blank"; id: string };
type FillWord = { id: string; text: string };
type FillTemplate = { segments: FillSegment[]; wordBank: FillWord[] } | null;

type PuzzleOption = { id: string; left: string; right: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTextFromJsonContent(value: Json): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (typeof rec.text === "string") {
      return rec.text;
    }
  }
  return "";
}

function readString(rec: JsonRecord, key: string): string {
  const val = rec[key];
  return typeof val === "string" ? val : "";
}

function parseBracketTemplate(text: string): FillSegment[] {
  const out: FillSegment[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let index = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "blank", id: `blank-${index++}` });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length > 0 ? out : [{ type: "text", value: text }];
}

function getFillTemplate(question: SafeTestForClientPayload["questions"][number]): FillTemplate {
  if (isRecord(question.content)) {
    const rawSegments = question.content.segments;
    const rawWordBank = question.content.wordBank;
    if (Array.isArray(rawSegments) && Array.isArray(rawWordBank)) {
      const segments: FillSegment[] = [];
      for (const item of rawSegments) {
        if (!isRecord(item)) continue;
        if (item.type === "text" && typeof item.value === "string") {
          segments.push({ type: "text", value: item.value });
        }
        if (item.type === "blank" && typeof item.id === "string") {
          segments.push({ type: "blank", id: item.id });
        }
      }
      const wordBank: FillWord[] = [];
      for (const item of rawWordBank) {
        if (!isRecord(item)) continue;
        if (typeof item.id === "string" && typeof item.text === "string") {
          wordBank.push({ id: item.id, text: item.text });
        }
      }
      if (segments.length > 0) {
        return { segments, wordBank };
      }
    }
  }
  const fallbackText = readTextFromJsonContent(question.content).trim();
  if (!fallbackText) return null;
  return { segments: parseBracketTemplate(fallbackText), wordBank: [] };
}

function getPuzzleOptions(question: SafeTestForClientPayload["questions"][number]): PuzzleOption[] {
  return question.options
    .map((o) => {
      if (!isRecord(o.content)) return null;
      const left = readString(o.content, "left");
      const right = readString(o.content, "right");
      if (!left && !right) return null;
      return { id: o.id, left, right };
    })
    .filter((x): x is PuzzleOption => x !== null);
}

function getImageLabelOptions(question: SafeTestForClientPayload["questions"][number]) {
  return question.options
    .map((o) => {
      if (!isRecord(o.content)) return null;
      const imageUrl = readString(o.content, "imageUrl");
      const title = readString(o.content, "title");
      const correctText = readString(o.content, "correctText");
      if (!imageUrl) return null;
      return { optionId: o.id, imageUrl, title, correctText };
    })
    .filter((x): x is { optionId: string; imageUrl: string; title: string; correctText: string } => x !== null);
}

export function TestRunner({
  testId,
  previewMode = false,
}: {
  testId: string;
  previewMode?: boolean;
}) {
  const [state, setState] = useState<RunnerState>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [testData, setTestData] = useState<SafeTestForClientPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const totalQuestions = testData?.questions.length ?? 0;
  const answeredQuestions = useMemo(
    () => {
      return Object.values(answers).filter((a) => {
        if (Array.isArray(a.option_ids) && a.option_ids.length > 0) return true;
        if (!isRecord(a.answer_data)) return false;
        return Object.keys(a.answer_data).length > 0;
      }).length;
    },
    [answers],
  );

  async function handleStart() {
    setState("loading");
    setError(null);

    const testResult = await getSafeTestForClient(testId);

    if (!testResult.success) {
      setError(testResult.error);
      setState("idle");
      return;
    }

    if (previewMode) {
      setAttemptId("preview-mode");
    } else {
      const attemptResult = await startTestAttempt(testId);
      if (!attemptResult.success) {
        setError(attemptResult.error);
        setState("idle");
        return;
      }
      setAttemptId(attemptResult.attemptId);
    }

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

  function setFillBlankValue(
    questionId: string,
    blankId: string,
    rawValue: string,
    wordBank: FillWord[],
  ) {
    setAnswers((prev) => {
      const current = prev[questionId];
      const currentData = isRecord(current?.answer_data) ? current.answer_data : {};
      const currentAssignments = isRecord(currentData.fillAssignments)
        ? (currentData.fillAssignments as Record<string, string>)
        : {};

      const trimmed = rawValue.trim();
      const matchedWord = wordBank.find((w) => w.text.toLowerCase() === trimmed.toLowerCase());
      const resolved = matchedWord?.id ?? trimmed;

      const nextAssignments: Record<string, string> = {
        ...currentAssignments,
        [blankId]: resolved,
      };

      return {
        ...prev,
        [questionId]: {
          option_ids: current?.option_ids ?? [],
          answer_data: {
            ...currentData,
            fillAssignments: nextAssignments,
          },
        },
      };
    });
  }

  function setPuzzlePair(questionId: string, leftOptionId: string, rightOptionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId];
      const currentData = isRecord(current?.answer_data) ? current.answer_data : {};
      const rawPairs = Array.isArray(currentData.pairs) ? currentData.pairs : [];
      const parsedPairs = rawPairs.filter(
        (p): p is { leftOptionId: string; rightOptionId: string } =>
          isRecord(p) &&
          typeof p.leftOptionId === "string" &&
          typeof p.rightOptionId === "string",
      );

      const withoutLeft = parsedPairs.filter((p) => p.leftOptionId !== leftOptionId);
      const withoutRight = withoutLeft.filter((p) => p.rightOptionId !== rightOptionId);
      const nextPairs = [...withoutRight, { leftOptionId, rightOptionId }];

      return {
        ...prev,
        [questionId]: {
          option_ids: [...new Set(nextPairs.map((p) => p.leftOptionId))],
          answer_data: {
            ...currentData,
            pairs: nextPairs,
          },
        },
      };
    });
  }

  function setImageLabel(questionId: string, imageId: string, label: string) {
    setAnswers((prev) => {
      const current = prev[questionId];
      const currentData = isRecord(current?.answer_data) ? current.answer_data : {};
      const rawLabels = isRecord(currentData.labels) ? currentData.labels : {};
      const nextLabels = { ...rawLabels, [imageId]: label };
      const labelPairs = Object.entries(nextLabels)
        .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
        .map(([imageIdKey, word]) => ({ imageId: imageIdKey, wordId: String(word) }));

      return {
        ...prev,
        [questionId]: {
          option_ids: current?.option_ids ?? [],
          answer_data: {
            ...currentData,
            labels: nextLabels,
            labelPairs,
          },
        },
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

    if (previewMode) {
      const simulatedScore = Math.round(
        (answeredQuestions / Math.max(totalQuestions, 1)) * 100,
      );
      setScore(simulatedScore);
      setState("completed");
      return;
    } else {
      const result = await submitTestAttempt(attemptId, payload);
      if (!result.success) {
        setError(result.error);
        setState("in_progress");
        return;
      }

      setScore(result.score);
      setState("completed");
    }
  }

  if (state === "idle" || state === "loading") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Тест</CardTitle>
            {previewMode ? <Badge variant="secondary">РЕЖИМ ПРЕДПРОСМОТРА</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {previewMode
              ? "Режим предпросмотра: результаты не сохраняются в базу данных."
              : "Нажмите кнопку ниже, чтобы начать прохождение."}
          </p>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button onClick={handleStart} disabled={state === "loading"}>
            {state === "loading"
              ? "Загрузка..."
              : previewMode
                ? "Открыть предпросмотр"
                : "Start Test"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "completed") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Тест завершен</CardTitle>
            {previewMode ? <Badge variant="secondary">РЕЖИМ ПРЕДПРОСМОТРА</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold">Ваш результат: {score ?? 0}%</p>
          <p className="text-muted-foreground text-sm">
            {previewMode
              ? "Это симулированный результат предпросмотра. Попытка не сохранялась."
              : "Спасибо за прохождение теста."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{testData?.title ?? "Тест"}</CardTitle>
            {previewMode ? <Badge variant="secondary">РЕЖИМ ПРЕДПРОСМОТРА</Badge> : null}
          </div>
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
        const isFill = question.type === "fill_in_the_blanks";
        const isPuzzle =
          question.type === "matching_puzzle" || question.type === "dnd_puzzle";
        const isImageLabeling = question.type === "image_labeling";

        const fillTemplate = isFill ? getFillTemplate(question) : null;
        const puzzleOptions = isPuzzle ? getPuzzleOptions(question) : [];
        const imageLabelOptions = isImageLabeling ? getImageLabelOptions(question) : [];

        const answerData: Record<string, unknown> = isRecord(
          answers[question.id]?.answer_data,
        )
          ? (answers[question.id]?.answer_data as Record<string, unknown>)
          : {};
        const fillAssignments = isRecord(answerData?.fillAssignments)
          ? (answerData.fillAssignments as Record<string, string>)
          : {};
        const puzzlePairs = Array.isArray(answerData?.pairs)
          ? (answerData.pairs as { leftOptionId: string; rightOptionId: string }[])
          : [];
        const imageLabels = isRecord(answerData?.labels)
          ? (answerData.labels as Record<string, string>)
          : {};

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

              {isFill && fillTemplate ? (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <PenLine className="size-4" aria-hidden />
                    Заполните пропуски
                  </div>
                  <p className="text-sm leading-7">
                    {fillTemplate.segments.map((seg, idx) =>
                      seg.type === "text" ? (
                        <span key={`${seg.type}-${idx}`}>{seg.value}</span>
                      ) : (
                        <Input
                          key={seg.id}
                          value={fillAssignments[seg.id] ?? ""}
                          onChange={(e) =>
                            setFillBlankValue(
                              question.id,
                              seg.id,
                              e.target.value,
                              fillTemplate.wordBank,
                            )
                          }
                          className="mx-1 inline-flex h-9 w-32 align-middle"
                          aria-label={`Ответ для пропуска ${idx + 1}`}
                        />
                      ),
                    )}
                  </p>
                </div>
              ) : null}

              {isPuzzle && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="size-4" aria-hidden />
                    Кликните слева, затем справа, чтобы создать пару
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Left items
                      </p>
                      {puzzleOptions.map((left) => {
                        const pair = puzzlePairs.find((p) => p.leftOptionId === left.id);
                        return (
                          <div
                            key={`left-${left.id}`}
                            className="rounded-lg border border-border bg-background p-2"
                          >
                            <p className="text-sm">{left.left || "—"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {puzzleOptions.map((right) => {
                                const active = pair?.rightOptionId === right.id;
                                return (
                                  <button
                                    key={`${left.id}-${right.id}`}
                                    type="button"
                                    className={`h-9 rounded-md border px-2 text-xs ${
                                      active
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border bg-muted/30 hover:bg-muted"
                                    }`}
                                    onClick={() => setPuzzlePair(question.id, left.id, right.id)}
                                    aria-pressed={active}
                                  >
                                    {right.right || "—"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Right items
                      </p>
                      {puzzleOptions.map((right) => (
                        <div
                          key={`right-${right.id}`}
                          className="rounded-lg border border-border bg-background p-2 text-sm"
                        >
                          {right.right || "—"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isImageLabeling && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="size-4" aria-hidden />
                    Подпишите изображения
                  </div>
                  {imageLabelOptions.map((item, i) => {
                    const words = imageLabelOptions
                      .map((x) => x.correctText)
                      .filter((t) => t.trim().length > 0);
                    const selectedWord = imageLabels[item.optionId] ?? "";
                    return (
                      <div
                        key={item.optionId}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="relative overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.title || `Изображение ${i + 1}`}
                            className="h-40 w-full object-cover"
                          />
                          {isRecord(question.content) && Array.isArray(question.content.markers)
                            ? (question.content.markers as unknown[]).map((m, mi) => {
                                if (!isRecord(m)) return null;
                                const x = typeof m.x === "number" ? m.x : null;
                                const y = typeof m.y === "number" ? m.y : null;
                                if (x === null || y === null) return null;
                                return (
                                  <span
                                    key={`${item.optionId}-m-${mi}`}
                                    className="absolute size-3 rounded-full border-2 border-white bg-primary"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                  />
                                );
                              })
                            : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">{item.title || `Картинка ${i + 1}`}</p>
                          <Select
                            value={selectedWord}
                            onValueChange={(val) => setImageLabel(question.id, item.optionId, val)}
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue placeholder="Выберите подпись" />
                            </SelectTrigger>
                            <SelectContent>
                              {words.map((word) => (
                                <SelectItem key={`${item.optionId}-${word}`} value={word}>
                                  {word}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
