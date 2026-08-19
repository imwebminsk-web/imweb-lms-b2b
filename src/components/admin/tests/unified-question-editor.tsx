"use client";

import { useState } from "react";
import { Editor } from "@/components/ui/editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { ChoiceTaskItemsEditor } from "@/components/admin/questions/ChoiceTaskItemsEditor";
import { OrderingItemsEditor } from "@/components/admin/questions/OrderingItemsEditor";
import { GroupedFillBlanksItemsEditor } from "@/components/admin/questions/GroupedFillBlanksItemsEditor";
import { ImageLabelingImageUploadField } from "@/components/admin/questions/ImageLabelingImageUploadField";

import type {
  QuestionField,
  QuestionKind,
  LabelingPairField,
  PuzzleOptionField,
} from "@/types/create-test-form";

import {
  defaultOptionsForType,
  defaultImageLabelingQuestion,
  defaultGroupedFillBlanksQuestion,
  defaultOrderingQuestion,
  defaultChoiceQuestion,
  emptyQuestion,
  sumChoiceTaskPoints,
  isChoiceQuestion,
  isOrderingQuestion,
  sumOrderingTaskPoints,
  parsePositiveInt,
  parseNonNegativeInt,
  isPuzzleQuestion,
  isImageLabelingQuestion,
  isPartialPairScoringQuestion,
  isItemLevelScoringQuestion,
  resolveAdminQuestionMaxPoints,
  taskUnitPointsLabel,
  isGroupedFillBlanksQuestion,
  sumGroupedFillBlanksPoints,
} from "@/lib/admin/test-question-form-utils";

import { isGapFillSingleTextQuestionType } from "@/lib/grouped-fill-blanks-utils";

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  single_choice: "Один выбор",
  multiple_choice: "Множественный выбор",
  matching_puzzle: "Сопоставление пар (клик)",
  dnd_puzzle: "Визуальный пазл (стыковка)",
  image_labeling: "Метки на картинке",
  fill_in_the_blanks: "Пропуски из списка (Единый текст)",
  fill_in_the_blanks_multi: "Пропуски из списка (Отдельные предложения)",
  fill_blanks_typing: "Пропуски вручную (Единый текст)",
  fill_blanks_typing_multi: "Пропуски вручную (Отдельные предложения)",
  text_input: "Развернутый ответ",
  ordering: "Упорядочивание",
};

export interface UnifiedQuestionEditorProps {
  questions: QuestionField[];
  onQuestionsChange: (questions: QuestionField[]) => void;
  pending?: boolean;
}

export function UnifiedQuestionEditor({
  questions,
  onQuestionsChange,
  pending = false,
}: UnifiedQuestionEditorProps) {
  const [mobileExpandedQuestionIndex, setMobileExpandedQuestionIndex] = useState(-1);

  function jumpToQuestion(index: number) {
    setMobileExpandedQuestionIndex(index);
    document
      .getElementById(`test-question-${index}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateQuestion(i: number, patch: Partial<QuestionField>) {
    onQuestionsChange(
      questions.map((q, idx) =>
        idx === i ? ({ ...q, ...patch } as QuestionField) : q,
      ),
    );
  }

  function changeQuestionType(qi: number, kind: QuestionKind) {
    onQuestionsChange(
      questions.map((q, idx) => {
        if (idx !== qi) return q;
        if (q.type === kind) return q;
        const questionPoints = q.points ?? 1;
        const questionExample = q.exampleText ?? "";
        if (kind === "single_choice" || kind === "multiple_choice") {
          if (isChoiceQuestion(q)) {
            return {
              ...q,
              type: kind,
              points: sumChoiceTaskPoints(q),
            };
          }
          return {
            ...defaultChoiceQuestion(kind),
            text: q.text,
            exampleText: questionExample,
          };
        }
        if (kind === "image_labeling") {
          return {
            ...defaultImageLabelingQuestion(),
            text: q.text,
            points: questionPoints,
            exampleText: questionExample,
          };
        }
        if (
          kind === "fill_in_the_blanks" ||
          kind === "fill_in_the_blanks_multi" ||
          kind === "fill_blanks_typing" ||
          kind === "fill_blanks_typing_multi" ||
          kind === "text_input"
        ) {
          if (isGroupedFillBlanksQuestion(q)) {
            const items = isGapFillSingleTextQuestionType(kind)
              ? q.items.slice(0, 1)
              : q.items;
            const next = {
              ...q,
              type: kind,
              text: q.text,
              items,
              exampleText: questionExample,
            };
            return {
              ...next,
              points: sumGroupedFillBlanksPoints(next),
            };
          }
          return {
            ...defaultGroupedFillBlanksQuestion(kind),
            text: q.text,
            points: questionPoints,
            exampleText: questionExample,
          };
        }
        if (kind === "ordering") {
          if (isOrderingQuestion(q)) {
            return {
              ...q,
              points: sumOrderingTaskPoints(q),
            };
          }
          return {
            ...defaultOrderingQuestion(),
            text: q.text,
            exampleText: questionExample,
          };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isChoiceQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isGroupedFillBlanksQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isOrderingQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        return {
          text: q.text,
          type: kind,
          points: questionPoints,
          exampleText: questionExample,
          options: defaultOptionsForType(kind),
        } as QuestionField;
      }),
    );
  }

  function updateGroupedFillItems(
    qi: number,
    items: Extract<
      QuestionField,
      {
        type:
          | "fill_in_the_blanks"
          | "fill_in_the_blanks_multi"
          | "fill_blanks_typing"
          | "fill_blanks_typing_multi"
          | "text_input";
      }
    >["items"],
  ) {
    onQuestionsChange(
      questions.map((q, idx) => {
        if (idx !== qi || !isGroupedFillBlanksQuestion(q)) return q;
        const normalizedItems = isGapFillSingleTextQuestionType(q.type)
          ? items.slice(0, 1)
          : items;
        return {
          ...q,
          items: normalizedItems,
          points: sumGroupedFillBlanksPoints({
            ...q,
            items: normalizedItems,
          }),
        };
      }),
    );
  }

  function updateChoiceItems(
    qi: number,
    items: Extract<
      QuestionField,
      { type: "single_choice" | "multiple_choice" }
    >["items"],
  ) {
    onQuestionsChange(
      questions.map((q, idx) => {
        if (idx !== qi || !isChoiceQuestion(q)) return q;
        return {
          ...q,
          items,
          points: items.reduce(
            (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
            0,
          ),
        };
      }),
    );
  }

  function updateOrderingItems(
    qi: number,
    items: Extract<QuestionField, { type: "ordering" }>["items"],
  ) {
    onQuestionsChange(
      questions.map((q, idx) => {
        if (idx !== qi || !isOrderingQuestion(q)) return q;
        return {
          ...q,
          items,
          points: items.reduce(
            (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
            0,
          ),
        };
      }),
    );
  }

  function updatePuzzleOption(
    qi: number,
    oi: number,
    patch: Partial<PuzzleOptionField>,
  ) {
    onQuestionsChange(
      questions.map((q, idx) => {
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
    onQuestionsChange(
      questions.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        const labelingPairs = q.labelingPairs.map((row, j) =>
          j === pi ? { ...row, ...patch } : row,
        );
        return { ...q, labelingPairs };
      }),
    );
  }

  function addLabelingPair(qi: number) {
    onQuestionsChange(
      questions.map((q, idx) => {
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
    onQuestionsChange(
      questions.map((q, idx) => {
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
    onQuestionsChange([...questions, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    onQuestionsChange(
      questions.length <= 1 ? questions : questions.filter((_, idx) => idx !== i),
    );
  }

  function addOption(qi: number) {
    onQuestionsChange(
      questions.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (isPuzzleQuestion(q)) {
          return {
            ...q,
            options: [...q.options, { left: "", right: "" }],
          } as QuestionField;
        }
        if (isImageLabelingQuestion(q) || isGroupedFillBlanksQuestion(q) || isChoiceQuestion(q) || isOrderingQuestion(q)) {
          return q;
        }
        return q;
      }),
    );
  }

  function removeOption(qi: number, oi: number) {
    onQuestionsChange(
      questions.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (
          isImageLabelingQuestion(q) ||
          isGroupedFillBlanksQuestion(q) ||
          isChoiceQuestion(q) ||
          isOrderingQuestion(q) ||
          !isPuzzleQuestion(q)
        ) {
          return q;
        }
        if (q.options.length <= 1) return q;
        return {
          ...q,
          options: q.options.filter((_, j) => j !== oi),
        };
      }),
    );
  }

  return (
    <>
      <details className="rounded-lg border bg-muted/30 p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium">
          Список заданий ({questions.length})
        </summary>
        <ul className="mt-3 flex flex-col gap-1">
          {questions.map((q, qi) => (
            <li key={qi}>
              <button
                type="button"
                className={cn(
                  "hover:bg-muted w-full rounded-md px-2 py-2.5 text-left text-sm transition-colors",
                  mobileExpandedQuestionIndex === qi && "bg-muted font-medium",
                )}
                onClick={() => jumpToQuestion(qi)}
              >
                Задание {qi + 1} — {QUESTION_TYPE_LABELS[q.type]}
              </button>
            </li>
          ))}
        </ul>
      </details>

      {questions.map((q, qi) => (
        <Card key={qi} id={`test-question-${qi}`} className="shrink-0">
          <CardHeader
            className="flex cursor-pointer flex-col items-start gap-3 space-y-0 lg:cursor-default lg:flex-row lg:items-center lg:justify-between"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                return;
              }
              setMobileExpandedQuestionIndex((current) =>
                current === qi ? -1 : qi,
              );
            }}
          >
            <div className="flex w-full flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
              <CardTitle className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-start">
                <span>Задание {qi + 1}</span>
                <span className="text-muted-foreground text-xs font-normal lg:hidden">
                  {mobileExpandedQuestionIndex === qi ? "Свернуть" : "Развернуть"}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {isItemLevelScoringQuestion(q) ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    Баллы за задание: {resolveAdminQuestionMaxPoints(q)}
                  </span>
                ) : (
                  <>
                    <Label
                      htmlFor={`q-points-${qi}`}
                      className="text-muted-foreground text-xs font-normal"
                    >
                      {taskUnitPointsLabel(q)}
                    </Label>
                    <Input
                      id={`q-points-${qi}`}
                      type="number"
                      min={1}
                      step={1}
                      className="h-8 w-20"
                      value={q.points ?? 1}
                      onChange={(e) =>
                        updateQuestion(qi, {
                          points: parsePositiveInt(e.target.value, 1),
                        })
                      }
                    />
                    {isPartialPairScoringQuestion(q) ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {resolveAdminQuestionMaxPoints(q)}
                      </Badge>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={(event) => {
                event.stopPropagation();
                removeQuestion(qi);
              }}
              disabled={questions.length <= 1}
            >
              Удалить задание
            </Button>
          </CardHeader>
          <CardContent
            className={cn(
              "space-y-4",
              mobileExpandedQuestionIndex !== qi && "max-lg:hidden",
            )}
          >
            <div className="space-y-2">
              <Label htmlFor={`q-text-${qi}`}>
                Формулировка задания (Инструкция и текст) *
              </Label>
              <Editor
                id={`q-text-${qi}`}
                value={q.text}
                onChange={(next) => updateQuestion(qi, { text: next })}
                disabled={pending}
              />
              <p className="text-muted-foreground text-xs">
                Заголовки, списки, изображения и аудио сохраняются как HTML для ученика.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`q-media-limit-${qi}`}>
                Лимит прослушиваний (0 = безлимит)
              </Label>
              <Input
                id={`q-media-limit-${qi}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="max-w-xs"
                value={q.mediaPlayLimit ?? 0}
                onChange={(e) =>
                  updateQuestion(qi, {
                    mediaPlayLimit: parseNonNegativeInt(e.target.value, 0),
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Внимание: лимит работает только для загруженных аудио и видео. На
                ссылки YouTube (iframe) ограничение не действует.
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium" id={`q-type-label-${qi}`}>
                Тип выполнения
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
                  <SelectItem value="single_choice">
                    {QUESTION_TYPE_LABELS.single_choice}
                  </SelectItem>
                  <SelectItem value="multiple_choice">
                    {QUESTION_TYPE_LABELS.multiple_choice}
                  </SelectItem>
                  <SelectItem value="matching_puzzle">
                    {QUESTION_TYPE_LABELS.matching_puzzle}
                  </SelectItem>
                  <SelectItem value="dnd_puzzle">
                    {QUESTION_TYPE_LABELS.dnd_puzzle}
                  </SelectItem>
                  <SelectItem value="image_labeling">
                    {QUESTION_TYPE_LABELS.image_labeling}
                  </SelectItem>
                  <SelectItem value="fill_in_the_blanks">
                    {QUESTION_TYPE_LABELS.fill_in_the_blanks}
                  </SelectItem>
                  <SelectItem value="fill_in_the_blanks_multi">
                    {QUESTION_TYPE_LABELS.fill_in_the_blanks_multi}
                  </SelectItem>
                  <SelectItem value="fill_blanks_typing">
                    {QUESTION_TYPE_LABELS.fill_blanks_typing}
                  </SelectItem>
                  <SelectItem value="fill_blanks_typing_multi">
                    {QUESTION_TYPE_LABELS.fill_blanks_typing_multi}
                  </SelectItem>
                  <SelectItem value="text_input">
                    {QUESTION_TYPE_LABELS.text_input}
                  </SelectItem>
                  <SelectItem value="ordering">
                    {QUESTION_TYPE_LABELS.ordering}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isGroupedFillBlanksQuestion(q) ? (
              <GroupedFillBlanksItemsEditor
                items={q.items}
                questionType={q.type}
                onItemsChange={(items) => updateGroupedFillItems(qi, items)}
              />
            ) : isChoiceQuestion(q) ? (
              <ChoiceTaskItemsEditor
                items={q.items}
                isMultiple={q.type === "multiple_choice"}
                onItemsChange={(items) => updateChoiceItems(qi, items)}
              />
            ) : isOrderingQuestion(q) ? (
              <OrderingItemsEditor
                items={q.items}
                onItemsChange={(items) => updateOrderingItems(qi, items)}
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
                      <div className="min-w-0">
                        <ImageLabelingImageUploadField
                          value={pair.url}
                          onUrlChange={(url) =>
                            updateLabelingPair(qi, pi, { url })
                          }
                          disabled={pending}
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
                <span className="text-sm font-medium">Пары для сопоставления</span>
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
                  : null}
                {isPuzzleQuestion(q) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(qi)}
                  >
                    + Пара
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex shrink-0 flex-col gap-3">
        <Button type="button" variant="outline" onClick={addQuestion} className="w-fit">
          + Задание
        </Button>
      </div>
    </>
  );
}
