"use client";

import type { GroupedChoicePlayerItem } from "@/lib/grouped-choice-utils";
import { cn } from "@/lib/utils";
import { RichTextHtml, richTextPlainLabel } from "@/components/quiz/RichTextHtml";

export type GroupedChoiceTaskQuestionProps = {
  items: GroupedChoicePlayerItem[];
  isMultiple: boolean;
  selections: Record<string, string[]>;
  onSelectionsChange?: (next: Record<string, string[]>) => void;
  isReviewMode?: boolean;
  correctByItemId?: Record<string, string[]>;
};

function optionLabelClass(selected: boolean, isCorrect: boolean | null): string {
  if (isCorrect === null) {
    return selected
      ? "border-primary bg-primary/10 ring-primary/20 ring-2"
      : "bg-card";
  }
  if (isCorrect) {
    return "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
  }
  return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100";
}

export function GroupedChoiceTaskQuestion({
  items,
  isMultiple,
  selections,
  onSelectionsChange,
  isReviewMode = false,
  correctByItemId,
}: GroupedChoiceTaskQuestionProps) {
  function toggleSelection(itemId: string, optionId: string) {
    if (isReviewMode) return;
    if (isMultiple) {
      const current = selections[itemId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      onSelectionsChange?.({ ...selections, [itemId]: next });
      return;
    }
    onSelectionsChange?.({ ...selections, [itemId]: [optionId] });
  }

  return (
    <div className="flex flex-col gap-6">
      {items.map((item, index) => {
        const selected = new Set(selections[item.id] ?? []);
        const correctIds = new Set(correctByItemId?.[item.id] ?? []);

        return (
          <section key={item.id} className="space-y-3">
            <div className="space-y-1">
              {items.length > 1 ? (
                <p className="text-muted-foreground text-sm font-medium">
                  Вопрос {index + 1}
                </p>
              ) : null}
              <RichTextHtml
                html={item.text}
                className="text-foreground text-lg font-medium leading-snug md:text-xl [&_strong]:font-semibold"
              />
            </div>
            <div
              className="flex flex-col gap-3"
              role={isMultiple ? "group" : "radiogroup"}
              aria-label={richTextPlainLabel(item.text)}
            >
              {item.options.map((opt) => {
                const isSelected = selected.has(opt.id);
                const isCorrect =
                  isReviewMode && correctByItemId
                    ? correctIds.has(opt.id)
                      ? true
                      : isSelected
                        ? false
                        : null
                    : null;

                if (isMultiple) {
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        "border-input hover:bg-muted/60 focus-within:ring-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 md:min-h-12",
                        optionLabelClass(isSelected, isCorrect),
                        isReviewMode && "cursor-default",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isReviewMode}
                        onChange={() => toggleSelection(item.id, opt.id)}
                        className="border-input text-primary mt-1 size-4 shrink-0 rounded"
                      />
                      <span className="text-left text-base leading-snug md:text-lg">
                        {opt.text}
                      </span>
                    </label>
                  );
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isReviewMode}
                    onClick={() => toggleSelection(item.id, opt.id)}
                    className={cn(
                      "border-input hover:bg-muted/60 focus-visible:ring-ring flex min-h-11 w-full items-center rounded-xl border px-4 py-3 text-left text-base transition-colors focus-visible:ring-2 focus-visible:outline-none md:min-h-12 md:text-lg",
                      optionLabelClass(isSelected, isCorrect),
                      isReviewMode && "cursor-default",
                    )}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function isGroupedChoiceSelectionComplete(
  items: GroupedChoicePlayerItem[],
  selections: Record<string, string[]>,
  isMultiple: boolean,
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => {
    const selected = selections[item.id] ?? [];
    return isMultiple ? selected.length >= 1 : selected.length === 1;
  });
}
