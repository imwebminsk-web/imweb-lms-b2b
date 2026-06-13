"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseGroupedFillBlanksItemText,
  resolveGroupedFillBlanksMode,
} from "@/lib/grouped-fill-blanks-utils";
import { cn } from "@/lib/utils";
import type { GroupedFillBlanksItemField } from "@/types/create-test-form";

export type GroupedFillBlanksQuestionType =
  | "fill_in_the_blanks"
  | "fill_blanks_typing"
  | "text_input";

export type GroupedFillBlanksItemsEditorProps = {
  items: GroupedFillBlanksItemField[];
  questionType: GroupedFillBlanksQuestionType;
  onItemsChange: (items: GroupedFillBlanksItemField[]) => void;
};

export function createDefaultGroupedFillBlanksItem(
  questionType: GroupedFillBlanksQuestionType,
): GroupedFillBlanksItemField {
  const text =
    questionType === "text_input"
      ? "Ответьте на вопрос: []"
      : "Мама [мыла] раму.";
  const mode = resolveGroupedFillBlanksMode(questionType);
  const parsed = parseGroupedFillBlanksItemText(text, mode, []);
  return {
    id: crypto.randomUUID(),
    text,
    points: 1,
    segments: parsed?.segments ?? [],
    wordBank: parsed?.wordBank ?? [],
    correctMapping: parsed?.correctMapping ?? {},
    extraWords: [],
  };
}

function parseItemFields(
  item: GroupedFillBlanksItemField,
  questionType: GroupedFillBlanksQuestionType,
): GroupedFillBlanksItemField {
  const mode = resolveGroupedFillBlanksMode(questionType);
  const parsed = parseGroupedFillBlanksItemText(
    item.text,
    mode,
    mode === "dnd" ? item.extraWords : [],
  );
  if (!parsed) {
    return {
      ...item,
      segments: [],
      wordBank: [],
      correctMapping: {},
    };
  }
  return {
    ...item,
    segments: parsed.segments,
    wordBank: parsed.wordBank,
    correctMapping: parsed.correctMapping,
  };
}

export function GroupedFillBlanksItemsEditor({
  items,
  questionType,
  onItemsChange,
}: GroupedFillBlanksItemsEditorProps) {
  const baseId = useId();
  const isTextInput = questionType === "text_input";
  const isDnd = questionType === "fill_in_the_blanks";
  const [distractorInputs, setDistractorInputs] = useState<Record<string, string>>(
    {},
  );

  function updateItem(itemIndex: number, patch: Partial<GroupedFillBlanksItemField>) {
    onItemsChange(
      items.map((item, idx) => {
        if (idx !== itemIndex) return item;
        const next = { ...item, ...patch };
        if ("text" in patch || "extraWords" in patch) {
          return parseItemFields(next, questionType);
        }
        return next;
      }),
    );
  }

  function addItem() {
    onItemsChange([...items, createDefaultGroupedFillBlanksItem(questionType)]);
  }

  function removeItem(itemIndex: number) {
    if (items.length <= 1) return;
    onItemsChange(items.filter((_, idx) => idx !== itemIndex));
  }

  function addDistractor(itemIndex: number) {
    const item = items[itemIndex];
    if (!item) return;
    const input = (distractorInputs[item.id] ?? "").trim();
    if (!input || item.extraWords.includes(input)) return;
    updateItem(itemIndex, { extraWords: [...item.extraWords, input] });
    setDistractorInputs((prev) => ({ ...prev, [item.id]: "" }));
  }

  function removeDistractor(itemIndex: number, word: string) {
    const item = items[itemIndex];
    if (!item) return;
    updateItem(itemIndex, {
      extraWords: item.extraWords.filter((w) => w !== word),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Вопросы задания</span>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Добавить вопрос
        </Button>
      </div>

      {items.map((item, itemIndex) => {
        const isValid = item.segments.some((seg) => seg.type === "blank");

        return (
          <div
            key={item.id}
            className="space-y-3 rounded-lg border border-dashed p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Вопрос {itemIndex + 1}</p>
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor={`${baseId}-points-${itemIndex}`}
                  className="text-muted-foreground text-xs whitespace-nowrap"
                >
                  Баллы:
                </Label>
                <Input
                  id={`${baseId}-points-${itemIndex}`}
                  type="number"
                  min={1}
                  step={1}
                  className="h-8 w-16"
                  value={item.points}
                  onChange={(e) =>
                    updateItem(itemIndex, {
                      points: Math.max(
                        1,
                        Number.parseInt(e.target.value, 10) || 1,
                      ),
                    })
                  }
                />
              </div>
              <div className="ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(itemIndex)}
                  disabled={items.length <= 1}
                >
                  Удалить
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor={`${baseId}-raw-${itemIndex}`}
              >
                Текст со скобками{" "}
                <span className="text-muted-foreground font-normal">
                  {isTextInput ? (
                    <>
                      (поля ответа: <code className="text-xs">[]</code>)
                    </>
                  ) : (
                    <>
                      (пропуски: <code className="text-xs">[слово]</code>)
                    </>
                  )}
                </span>
              </label>
              <textarea
                id={`${baseId}-raw-${itemIndex}`}
                value={item.text}
                onChange={(e) => updateItem(itemIndex, { text: e.target.value })}
                placeholder={
                  isTextInput
                    ? "Введите текст задания. Для добавления поля ввода используйте пустые скобки []"
                    : "Введите текст задания. Для пропуска используйте скобки [слово]"
                }
                rows={4}
                className={cn(
                  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-lg border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm",
                )}
              />
            </div>

            {isDnd ? (
              <div className="space-y-2">
                <span className="text-sm font-medium">
                  Дистракторы (лишние слова)
                </span>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={distractorInputs[item.id] ?? ""}
                    onChange={(e) =>
                      setDistractorInputs((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDistractor(itemIndex);
                      }
                    }}
                    placeholder="Введите слово и нажмите «Добавить»"
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => addDistractor(itemIndex)}
                  >
                    Добавить
                  </Button>
                </div>
                {item.extraWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.extraWords.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => removeDistractor(itemIndex, w)}
                        className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                      >
                        {w}
                        <span className="text-xs" aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="border-border rounded-lg border bg-muted/30 p-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Предпросмотр
              </p>
              {!isValid ? (
                <p className="text-destructive text-sm">
                  {isTextInput ? (
                    <>
                      Нужен хотя бы один пропуск{" "}
                      <code className="text-xs">[]</code>.
                    </>
                  ) : (
                    <>
                      Нужен хотя бы один непустой пропуск{" "}
                      <code className="text-xs">[слово]</code>.
                    </>
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-foreground text-sm leading-relaxed">
                    {item.segments.map((seg, i) =>
                      seg.type === "text" ? (
                        <span key={i}>{seg.value}</span>
                      ) : (
                        <span
                          key={i}
                          className="border-primary/40 bg-primary/10 text-primary mx-0.5 inline-block min-w-[4rem] rounded border px-2 py-0.5 text-center text-xs font-medium"
                        >
                          Пропуск
                        </span>
                      ),
                    )}
                  </p>
                  {isDnd && item.wordBank.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                        Банк слов (порядок как у ученика)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.wordBank.map((w) => (
                          <span
                            key={w.id}
                            className="bg-background border-border rounded-full border px-3 py-1 text-sm"
                          >
                            {w.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
