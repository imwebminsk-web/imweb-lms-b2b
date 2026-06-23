"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Editor } from "@/components/ui/editor";
import { ChoiceOptionImageUpload } from "@/components/admin/questions/ChoiceOptionImageUpload";
import type { ChoiceOptionField, ChoiceSubItemField } from "@/types/create-test-form";

export type ChoiceTaskItemsEditorProps = {
  items: ChoiceSubItemField[];
  isMultiple: boolean;
  onItemsChange: (items: ChoiceSubItemField[]) => void;
};

function defaultChoiceOption(): ChoiceOptionField {
  return {
    id: crypto.randomUUID(),
    text: "",
    isCorrect: false,
  };
}

export function createDefaultChoiceSubItem(): ChoiceSubItemField {
  return {
    id: crypto.randomUUID(),
    text: "",
    points: 1,
    options: [defaultChoiceOption(), defaultChoiceOption()],
  };
}

export function ChoiceTaskItemsEditor({
  items,
  isMultiple,
  onItemsChange,
}: ChoiceTaskItemsEditorProps) {
  const baseId = useId();

  function updateItem(itemIndex: number, patch: Partial<ChoiceSubItemField>) {
    onItemsChange(
      items.map((item, idx) =>
        idx === itemIndex ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateOption(
    itemIndex: number,
    optionIndex: number,
    patch: Partial<ChoiceOptionField>,
  ) {
    onItemsChange(
      items.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          options: item.options.map((opt, oi) =>
            oi === optionIndex ? { ...opt, ...patch } : opt,
          ),
        };
      }),
    );
  }

  function addItem() {
    onItemsChange([...items, createDefaultChoiceSubItem()]);
  }

  function removeItem(itemIndex: number) {
    if (items.length <= 1) return;
    onItemsChange(items.filter((_, idx) => idx !== itemIndex));
  }

  function addOption(itemIndex: number) {
    onItemsChange(
      items.map((item, idx) =>
        idx === itemIndex
          ? { ...item, options: [...item.options, defaultChoiceOption()] }
          : item,
      ),
    );
  }

  function removeOption(itemIndex: number, optionIndex: number) {
    onItemsChange(
      items.map((item, idx) => {
        if (idx !== itemIndex || item.options.length <= 1) return item;
        return {
          ...item,
          options: item.options.filter((_, oi) => oi !== optionIndex),
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Вопросы задания</span>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Добавить вопрос
        </Button>
      </div>

      {items.map((item, itemIndex) => (
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
                    points: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
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
                Удалить вопрос
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${baseId}-text-${itemIndex}`}>Текст вопроса *</Label>
            <Editor
              id={`${baseId}-text-${itemIndex}`}
              value={item.text}
              onChange={(next) => updateItem(itemIndex, { text: next })}
            />
          </div>

          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-medium">
              {isMultiple ? "Варианты (можно несколько верных)" : "Варианты ответа"}
            </span>
            {item.options.map((opt, optionIndex) => (
              <div
                key={opt.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-2 lg:border-0 lg:p-0"
              >
                <ChoiceOptionImageUpload
                  value={opt.imageUrl}
                  onUrlChange={(url) =>
                    updateOption(itemIndex, optionIndex, { imageUrl: url })
                  }
                />
                <Input
                  className="min-w-0 flex-1"
                  value={opt.text}
                  onChange={(e) =>
                    updateOption(itemIndex, optionIndex, { text: e.target.value })
                  }
                  placeholder={
                    opt.imageUrl
                      ? `Подпись к варианту ${optionIndex + 1} (необязательно)`
                      : `Вариант ${optionIndex + 1}`
                  }
                  required={!opt.imageUrl}
                />
                <label className="flex min-h-11 shrink-0 items-center gap-3 text-sm lg:whitespace-nowrap">
                  <input
                    type={isMultiple ? "checkbox" : "radio"}
                    name={`${baseId}-correct-${itemIndex}`}
                    checked={opt.isCorrect}
                    onChange={(e) => {
                      if (isMultiple) {
                        updateOption(itemIndex, optionIndex, {
                          isCorrect: e.target.checked,
                        });
                        return;
                      }
                      onItemsChange(
                        items.map((it, idx) =>
                          idx === itemIndex
                            ? {
                                ...it,
                                options: it.options.map((o, oi) => ({
                                  ...o,
                                  isCorrect: oi === optionIndex,
                                })),
                              }
                            : it,
                        ),
                      );
                    }}
                    className="size-5 rounded border-input"
                  />
                  Верный
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full lg:w-auto"
                  onClick={() => removeOption(itemIndex, optionIndex)}
                  disabled={item.options.length <= 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addOption(itemIndex)}
            >
              + Вариант
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
