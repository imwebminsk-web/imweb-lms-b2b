"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveFullTest } from "@/app/actions/test-actions";
import { FillInTheBlanksEditor } from "@/components/admin/questions/FillInTheBlanksEditor";
import { Button } from "@/components/ui/button";
import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";
import { saveFullTestPayloadSchema } from "@/lib/validations/admin-test-schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuestionKind =
  | "single_choice"
  | "multiple_choice"
  | "matching_puzzle"
  | "dnd_puzzle"
  | "image_labeling"
  | "fill_in_the_blanks";

type ChoiceOptionField = { text: string; isCorrect: boolean };
type PuzzleOptionField = { left: string; right: string };
/** Одна строка в БД: картинка + правильное слово для неё. */
type LabelingPairField = { url: string; correctWord: string; title: string };
export type CreateTestValues = z.infer<typeof saveFullTestPayloadSchema>;

type QuestionField =
  | {
      text: string;
      type: "single_choice" | "multiple_choice";
      options: ChoiceOptionField[];
    }
  | {
      text: string;
      type: "matching_puzzle" | "dnd_puzzle";
      options: PuzzleOptionField[];
    }
  | {
      text: string;
      type: "image_labeling";
      labelingPairs: LabelingPairField[];
    }
  | {
      text: string;
      type: "fill_in_the_blanks";
      fillRawText: string;
      fillExtraWords: string[];
      fillContent: FillInTheBlanksContent | null;
    };

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  single_choice: "Один ответ",
  multiple_choice: "Несколько ответов",
  matching_puzzle: "Пазл",
  dnd_puzzle: "Супер-Пазл",
  image_labeling: "Подпиши картинку",
  fill_in_the_blanks: "Заполнить пропуски",
};

function defaultOptionsForType(
  kind: Exclude<QuestionKind, "image_labeling" | "fill_in_the_blanks">,
): Exclude<
  QuestionField,
  { type: "image_labeling" } | { type: "fill_in_the_blanks" }
>["options"] {
  if (kind === "matching_puzzle" || kind === "dnd_puzzle") {
    return [
      { left: "", right: "" },
      { left: "", right: "" },
    ];
  }
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

function defaultImageLabelingQuestion(): Extract<
  QuestionField,
  { type: "image_labeling" }
> {
  return {
    text: "",
    type: "image_labeling",
    labelingPairs: [{ url: "", correctWord: "", title: "" }],
  };
}

function defaultFillInTheBlanksQuestion(): Extract<
  QuestionField,
  { type: "fill_in_the_blanks" }
> {
  return {
    text: "",
    type: "fill_in_the_blanks",
    fillRawText: "Мама [мыла] раму.",
    fillExtraWords: [],
    fillContent: null,
  };
}

function emptyQuestion(): QuestionField {
  return {
    text: "",
    type: "single_choice",
    options: defaultOptionsForType("single_choice") as ChoiceOptionField[],
  };
}

function isPuzzleQuestion(
  q: QuestionField,
): q is Extract<
  QuestionField,
  { type: "matching_puzzle" | "dnd_puzzle" }
> {
  return q.type === "matching_puzzle" || q.type === "dnd_puzzle";
}

function isImageLabelingQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "image_labeling" }> {
  return q.type === "image_labeling";
}

function isFillInTheBlanksQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "fill_in_the_blanks" }> {
  return q.type === "fill_in_the_blanks";
}

// TODO: Перевести форму на useForm<CreateTestValues> вместо ручного useState.
export function CreateTestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionField[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateQuestion(i: number, patch: Partial<QuestionField>) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === i ? ({ ...q, ...patch } as QuestionField) : q,
      ),
    );
  }

  function changeQuestionType(qi: number, kind: QuestionKind) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi) return q;
        if (q.type === kind) return q;
        if (kind === "image_labeling") {
          return { ...defaultImageLabelingQuestion(), text: q.text };
        }
        if (kind === "fill_in_the_blanks") {
          return { ...defaultFillInTheBlanksQuestion(), text: q.text };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isFillInTheBlanksQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        return {
          text: q.text,
          type: kind,
          options: defaultOptionsForType(kind),
        } as QuestionField;
      }),
    );
  }

  function updateChoiceOption(
    qi: number,
    oi: number,
    patch: Partial<ChoiceOptionField>,
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (
          idx !== qi ||
          q.type === "matching_puzzle" ||
          q.type === "dnd_puzzle" ||
          q.type === "image_labeling" ||
          q.type === "fill_in_the_blanks"
        ) {
          return q;
        }
        const options = q.options.map((o, j) =>
          j === oi ? { ...o, ...patch } : o,
        );
        return { ...q, options } as QuestionField;
      }),
    );
  }

  function updatePuzzleOption(
    qi: number,
    oi: number,
    patch: Partial<PuzzleOptionField>,
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isPuzzleQuestion(q)) {
          return q;
        }
        const options = q.options.map((o, j) =>
          j === oi ? { ...o, ...patch } : o,
        );
        return { ...q, options } as QuestionField;
      }),
    );
  }

  function updateLabelingPair(
    qi: number,
    pi: number,
    patch: Partial<LabelingPairField>,
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        const labelingPairs = q.labelingPairs.map((row, j) =>
          j === pi ? { ...row, ...patch } : row,
        );
        return { ...q, labelingPairs };
      }),
    );
  }

  function addLabelingPair(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        return {
          ...q,
          labelingPairs: [
            ...q.labelingPairs,
            { url: "", correctWord: "", title: "" },
          ],
        };
      }),
    );
  }

  function removeLabelingPair(qi: number, pi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        if (q.labelingPairs.length <= 1) return q;
        return {
          ...q,
          labelingPairs: q.labelingPairs.filter((_, j) => j !== pi),
        };
      }),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (isPuzzleQuestion(q)) {
          return {
            ...q,
            options: [...q.options, { left: "", right: "" }],
          } as QuestionField;
        }
        if (isImageLabelingQuestion(q) || isFillInTheBlanksQuestion(q)) {
          return q;
        }
        return {
          ...q,
          options: [...q.options, { text: "", isCorrect: false }],
        } as QuestionField;
      }),
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (isImageLabelingQuestion(q) || isFillInTheBlanksQuestion(q)) {
          return q;
        }
        if (q.options.length <= 1) return q;
        return {
          ...q,
          options: q.options.filter((_, j) => j !== oi),
        } as QuestionField;
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    for (const q of questions) {
      if (isFillInTheBlanksQuestion(q) && !q.fillContent) {
        setError(
          "Для вопроса «Заполнить пропуски» исправьте текст: нужен хотя бы один пропуск [слово] и валидный банк слов (см. предпросмотр).",
        );
        setPending(false);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      is_published: true,
      questions: questions.map((q) => {
        if (isPuzzleQuestion(q)) {
          return {
            content: { text: q.text.trim() },
            type: q.type,
            options: q.options.map((o) => ({
              content: {
                left: o.left.trim(),
                right: o.right.trim(),
              },
              is_correct: true as const,
            })),
          };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            content: { text: q.text.trim() },
            type: "image_labeling" as const,
            options: q.labelingPairs.map((p) => ({
              content: {
                imageUrl: p.url.trim(),
                correctText: p.correctWord.trim(),
                ...(p.title.trim() !== "" ? { title: p.title.trim() } : {}),
              },
              is_correct: true as const,
            })),
          };
        }
        if (isFillInTheBlanksQuestion(q)) {
          return {
            content: q.fillContent!,
            type: "fill_in_the_blanks" as const,
            options: [],
          };
        }
        return {
          content: { text: q.text.trim() },
          type: q.type,
          options: q.options.map((o) => ({
            content: { text: o.text.trim() },
            is_correct: o.isCorrect,
          })),
        };
      }),
    };

    const result = await saveFullTest(payload);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/test/${result.testId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Новый тест</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <label htmlFor="test-title" className="text-sm font-medium">
              Название
            </label>
            <Input
              id="test-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Вступительный тест"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="test-desc" className="text-sm font-medium">
              Описание
            </label>
            <Input
              id="test-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко, для кого тест"
            />
          </div>
        </CardContent>
      </Card>

      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Вопрос {qi + 1}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeQuestion(qi)}
              disabled={questions.length <= 1}
            >
              Удалить вопрос
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {isFillInTheBlanksQuestion(q)
                  ? "Подпись к вопросу (необязательно)"
                  : "Текст вопроса"}
              </label>
              <Input
                value={q.text}
                onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                placeholder={
                  isFillInTheBlanksQuestion(q)
                    ? "Краткий заголовок над упражнением"
                    : "Формулировка"
                }
                required={!isFillInTheBlanksQuestion(q)}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium" id={`q-type-label-${qi}`}>
                Тип вопроса
              </span>
              <Select
                value={q.type}
                onValueChange={(value) =>
                  changeQuestionType(qi, value as QuestionKind)
                }
              >
                <SelectTrigger
                  className="w-full max-w-md"
                  aria-labelledby={`q-type-label-${qi}`}
                >
                  <SelectValue>
                    {QUESTION_TYPE_LABELS[q.type]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Один ответ</SelectItem>
                  <SelectItem value="multiple_choice">
                    Несколько ответов
                  </SelectItem>
                  <SelectItem value="matching_puzzle">Пазл</SelectItem>
                  <SelectItem value="dnd_puzzle">Супер-Пазл</SelectItem>
                  <SelectItem value="image_labeling">
                    Подпиши картинку
                  </SelectItem>
                  <SelectItem value="fill_in_the_blanks">
                    Заполнить пропуски
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isFillInTheBlanksQuestion(q) ? (
              <FillInTheBlanksEditor
                rawText={q.fillRawText}
                extraWords={q.fillExtraWords}
                onRawTextChange={(v) =>
                  updateQuestion(qi, { fillRawText: v })
                }
                onExtraWordsChange={(w) =>
                  updateQuestion(qi, { fillExtraWords: w })
                }
                onFillContentChange={(c) =>
                  updateQuestion(qi, { fillContent: c })
                }
              />
            ) : isImageLabelingQuestion(q) ? (
              <div className="space-y-3">
                <span className="text-sm font-medium">
                  Пары «картинка — правильное слово» (у ученика слова в банке
                  будут в случайном порядке)
                </span>
                {q.labelingPairs.map((pair, pi) => (
                  <div
                    key={pi}
                    className="flex flex-col gap-2 rounded-lg border border-dashed p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1">
                        <label className="text-muted-foreground text-xs font-medium">
                          URL изображения
                        </label>
                        <Input
                          className="min-w-0"
                          value={pair.url}
                          onChange={(e) =>
                            updateLabelingPair(qi, pi, {
                              url: e.target.value,
                            })
                          }
                          placeholder="https://…"
                          required
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <label className="text-muted-foreground text-xs font-medium">
                          Правильное слово для этой картинки
                        </label>
                        <Input
                          className="min-w-0"
                          value={pair.correctWord}
                          onChange={(e) =>
                            updateLabelingPair(qi, pi, {
                              correctWord: e.target.value,
                            })
                          }
                          placeholder="Например: яблоко"
                          required
                        />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        Подпись к картинке (необязательно)
                      </label>
                      <Input
                        className="min-w-0"
                        value={pair.title}
                        onChange={(e) =>
                          updateLabelingPair(qi, pi, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Краткий заголовок"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLabelingPair(qi, pi)}
                        disabled={q.labelingPairs.length <= 1}
                      >
                        Удалить пару
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addLabelingPair(qi)}
                >
                  + Пара
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-sm font-medium">
                  {isPuzzleQuestion(q)
                    ? "Пары для сопоставления"
                    : "Варианты ответа"}
                </span>
                {isPuzzleQuestion(q)
                  ? q.options.map((o, oi) => (
                      <div
                        key={oi}
                        className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-end"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-muted-foreground text-xs font-medium">
                            Левая часть
                          </label>
                          <Input
                            className="min-w-0"
                            value={o.left}
                            onChange={(e) =>
                              updatePuzzleOption(qi, oi, {
                                left: e.target.value,
                              })
                            }
                            placeholder={`Пара ${oi + 1} — слева`}
                            required
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-muted-foreground text-xs font-medium">
                            Правая часть
                          </label>
                          <Input
                            className="min-w-0"
                            value={o.right}
                            onChange={(e) =>
                              updatePuzzleOption(qi, oi, {
                                right: e.target.value,
                              })
                            }
                            placeholder={`Пара ${oi + 1} — справа`}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => removeOption(qi, oi)}
                          disabled={q.options.length <= 1}
                        >
                          ✕
                        </Button>
                      </div>
                    ))
                  : q.options.map((o, oi) => (
                      <div
                        key={oi}
                        className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                      >
                        <Input
                          className="min-w-0 flex-1"
                          value={o.text}
                          onChange={(e) =>
                            updateChoiceOption(qi, oi, {
                              text: e.target.value,
                            })
                          }
                          placeholder={`Вариант ${oi + 1}`}
                          required
                        />
                        <label className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={o.isCorrect}
                            onChange={(e) =>
                              updateChoiceOption(qi, oi, {
                                isCorrect: e.target.checked,
                              })
                            }
                            className="size-4 rounded border-input"
                          />
                          Верный
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(qi, oi)}
                          disabled={q.options.length <= 1}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addOption(qi)}
                >
                  + {isPuzzleQuestion(q) ? "Пара" : "Вариант"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addQuestion}>
          + Вопрос
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="pb-4">
        <Button type="submit" disabled={pending} className="min-w-40">
          {pending ? "Сохранение…" : "Опубликовать и перейти"}
        </Button>
      </div>
    </form>
  );
}
