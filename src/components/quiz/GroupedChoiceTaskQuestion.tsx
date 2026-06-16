"use client";

import type { GroupedChoicePlayerItem, GroupedChoicePlayerOption } from "@/lib/grouped-choice-utils";
import { cn } from "@/lib/utils";
import { TaskMediaRenderer } from "@/components/quiz/TaskMediaRenderer";
import { richTextPlainLabel } from "@/components/quiz/RichTextHtml";

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

function itemUsesImageGrid(item: GroupedChoicePlayerItem): boolean {
  return item.options.some((opt) => Boolean(opt.image_url?.trim()));
}

function optionAriaLabel(opt: GroupedChoicePlayerOption): string {
  const text = opt.text.trim();
  if (text) return text;
  return "Вариант с изображением";
}

function ChoiceImageCard({
  opt,
  isSelected,
  isCorrect,
  isMultiple,
  isReviewMode,
  onSelect,
}: {
  opt: GroupedChoicePlayerOption;
  isSelected: boolean;
  isCorrect: boolean | null;
  isMultiple: boolean;
  isReviewMode: boolean;
  onSelect: () => void;
}) {
  const imageUrl = opt.image_url?.trim() ?? "";
  const hasText = Boolean(opt.text.trim());

  const indicator = (
    <span
      className={cn(
        "absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-full border bg-background/90 shadow-sm",
        isSelected && "border-primary",
      )}
      aria-hidden
    >
      {isMultiple ? (
        <span
          className={cn(
            "size-3.5 rounded-sm border border-input",
            isSelected && "border-primary bg-primary",
          )}
        />
      ) : (
        <span
          className={cn(
            "size-3.5 rounded-full border border-input",
            isSelected && "border-primary bg-primary",
          )}
        />
      )}
    </span>
  );

  const cardBody = (
    <>
      {indicator}
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
        />
      </div>
      {hasText ? (
        <div className="px-3 py-2 text-center text-sm leading-snug md:text-base">
          {opt.text}
        </div>
      ) : null}
    </>
  );

  if (isMultiple) {
    return (
      <label
        className={cn(
          "relative block cursor-pointer overflow-hidden rounded-xl border transition-colors",
          optionLabelClass(isSelected, isCorrect),
          isReviewMode && "cursor-default",
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isReviewMode}
          onChange={onSelect}
          className="sr-only"
          aria-label={optionAriaLabel(opt)}
        />
        {cardBody}
      </label>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={optionAriaLabel(opt)}
      disabled={isReviewMode}
      onClick={onSelect}
      className={cn(
        "relative block w-full overflow-hidden rounded-xl border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        optionLabelClass(isSelected, isCorrect),
        isReviewMode && "cursor-default",
      )}
    >
      {cardBody}
    </button>
  );
}

function ChoiceTextListOption({
  opt,
  isSelected,
  isCorrect,
  isMultiple,
  isReviewMode,
  onSelect,
}: {
  opt: GroupedChoicePlayerOption;
  isSelected: boolean;
  isCorrect: boolean | null;
  isMultiple: boolean;
  isReviewMode: boolean;
  onSelect: () => void;
}) {
  if (isMultiple) {
    return (
      <label
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
          onChange={onSelect}
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
      onClick={onSelect}
      className={cn(
        "border-input hover:bg-muted/60 focus-visible:ring-ring flex min-h-11 w-full items-center rounded-xl border px-4 py-3 text-left text-base transition-colors focus-visible:ring-2 focus-visible:outline-none md:min-h-12 md:text-lg",
        optionLabelClass(isSelected, isCorrect),
        isReviewMode && "cursor-default",
      )}
    >
      {opt.text}
    </button>
  );
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
    <div className="flex flex-col">
      <hr
        className="my-8 border-slate-200 dark:border-slate-700"
        aria-hidden
      />
      {items.map((item, index) => {
        const selected = new Set(selections[item.id] ?? []);
        const correctIds = new Set(correctByItemId?.[item.id] ?? []);
        const useImageGrid = itemUsesImageGrid(item);

        return (
          <section
            key={item.id}
            className={cn(
              "space-y-3",
              index !== items.length - 1 &&
                "mb-10 border-b border-slate-200 pb-10 dark:border-slate-700",
            )}
          >
            <div className="space-y-1">
              {items.length > 1 ? (
                <p className="mb-4 font-medium text-slate-500 dark:text-slate-400">
                  Вопрос {index + 1}
                </p>
              ) : null}
              <TaskMediaRenderer
                html={item.text}
                className="text-foreground text-lg font-medium leading-snug md:text-xl [&_strong]:font-semibold"
              />
            </div>
            <div
              className={cn(
                useImageGrid
                  ? "grid grid-cols-2 gap-3 sm:grid-cols-3"
                  : "flex flex-col gap-3",
              )}
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

                const onSelect = () => toggleSelection(item.id, opt.id);

                if (useImageGrid) {
                  return (
                    <ChoiceImageCard
                      key={opt.id}
                      opt={opt}
                      isSelected={isSelected}
                      isCorrect={isCorrect}
                      isMultiple={isMultiple}
                      isReviewMode={isReviewMode}
                      onSelect={onSelect}
                    />
                  );
                }

                return (
                  <ChoiceTextListOption
                    key={opt.id}
                    opt={opt}
                    isSelected={isSelected}
                    isCorrect={isCorrect}
                    isMultiple={isMultiple}
                    isReviewMode={isReviewMode}
                    onSelect={onSelect}
                  />
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
