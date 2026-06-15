"use client";

import parse, { type DOMNode, type Element } from "html-react-parser";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Editor } from "@/components/ui/editor";
import {
  isGapFillSingleTextQuestionType,
  isGapFillDndQuestionType,
  parseGroupedFillBlanksItemText,
  resolveGroupedFillBlanksMode,
} from "@/lib/grouped-fill-blanks-utils";
import { cn } from "@/lib/utils";
import type { GroupedFillBlanksItemField } from "@/types/create-test-form";

export type GroupedFillBlanksQuestionType =
  | "fill_in_the_blanks"
  | "fill_in_the_blanks_multi"
  | "fill_blanks_typing"
  | "fill_blanks_typing_multi"
  | "text_input";

export type GroupedFillBlanksItemsEditorProps = {
  items: GroupedFillBlanksItemField[];
  questionType: GroupedFillBlanksQuestionType;
  onItemsChange: (items: GroupedFillBlanksItemField[]) => void;
};

function isDomElement(node: DOMNode): node is Element {
  return node.type === "tag" && "attribs" in node;
}

export function createDefaultGroupedFillBlanksItem(
  questionType: GroupedFillBlanksQuestionType,
): GroupedFillBlanksItemField {
  const text =
    questionType === "text_input"
      ? "<p>Ответьте на вопрос: []</p>"
      : "<p>Мама [мыла] раму.</p>";
  const mode = resolveGroupedFillBlanksMode(questionType);
  const parsed = parseGroupedFillBlanksItemText(text, mode, []);
  return {
    id: crypto.randomUUID(),
    text,
    parsedHtml: parsed?.parsedHtml,
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
      parsedHtml: undefined,
      segments: [],
      wordBank: [],
      correctMapping: {},
    };
  }
  return {
    ...item,
    parsedHtml: parsed.parsedHtml,
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
  const isDnd = isGapFillDndQuestionType(questionType);
  const isSingleTextMode = isGapFillSingleTextQuestionType(questionType);
  const displayItems = isSingleTextMode ? items.slice(0, 1) : items;
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
    if (isSingleTextMode) return;
    onItemsChange([...items, createDefaultGroupedFillBlanksItem(questionType)]);
  }

  function removeItem(itemIndex: number) {
    if (isSingleTextMode || items.length <= 1) return;
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
        {!isSingleTextMode ? (
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            + Добавить вопрос
          </Button>
        ) : null}
      </div>

      {displayItems.map((item, itemIndex) => {
        const isValid = item.segments.some((seg) => seg.type === "blank");
        const previewHtml = item.parsedHtml ?? item.text;

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
                  {isTextInput ? "Баллы:" : "Баллы за 1 пропуск:"}
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
              {!isSingleTextMode ? (
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
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${baseId}-text-${itemIndex}`}>
                Текст вопроса *
              </Label>
              <p className="text-muted-foreground text-xs">
                Введите текст, добавляйте картинки/аудио, и используйте скобки{" "}
                {isTextInput ? (
                  <code className="text-xs">[]</code>
                ) : (
                  <code className="text-xs">[слово]</code>
                )}{" "}
                для пропусков.
              </p>
              <Editor
                id={`${baseId}-text-${itemIndex}`}
                value={item.text}
                onChange={(next) => updateItem(itemIndex, { text: next })}
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
                  <div
                    className={cn(
                      "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed",
                      "[&_.blank-placeholder]:border-primary/40 [&_.blank-placeholder]:bg-primary/10 [&_.blank-placeholder]:text-primary [&_.blank-placeholder]:mx-0.5 [&_.blank-placeholder]:inline-flex [&_.blank-placeholder]:min-h-[1.25rem] [&_.blank-placeholder]:min-w-[4rem] [&_.blank-placeholder]:items-center [&_.blank-placeholder]:justify-center [&_.blank-placeholder]:rounded [&_.blank-placeholder]:border [&_.blank-placeholder]:px-2 [&_.blank-placeholder]:text-xs [&_.blank-placeholder]:font-medium",
                    )}
                  >
                    {parse(previewHtml, {
                      replace(domNode) {
                        if (!isDomElement(domNode)) return undefined;
                        if (domNode.attribs["data-blank-id"]) {
                          return (
                            <span
                              key={domNode.attribs["data-blank-id"]}
                              className="blank-placeholder"
                            >
                              Пропуск
                            </span>
                          );
                        }
                        return undefined;
                      },
                    })}
                  </div>
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
