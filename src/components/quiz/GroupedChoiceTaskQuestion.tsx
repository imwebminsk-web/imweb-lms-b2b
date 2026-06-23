"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { ReviewSubQuestionHeader } from "@/components/quiz/ReviewSubQuestionHeader";
import { Badge } from "@/components/ui/badge";
import type { GroupedChoicePlayerItem, GroupedChoicePlayerOption } from "@/lib/grouped-choice-utils";
import type { ReviewItemScore } from "@/lib/quiz-result-scoring";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { TaskMediaRenderer } from "@/components/quiz/TaskMediaRenderer";
import { richTextPlainLabel } from "@/components/quiz/RichTextHtml";

export type GroupedChoiceTaskQuestionProps = {
  items: GroupedChoicePlayerItem[];
  isMultiple: boolean;
  selections: Record<string, string[]>;
  onSelectionsChange?: (next: Record<string, string[]>) => void;
  isReviewMode?: boolean;
  correctByItemId?: Record<string, string[]>;
  reviewItemScores?: Record<string, ReviewItemScore>;
};

type OptionReviewState =
  | "correct_selected"
  | "incorrect_selected"
  | "correct_missed"
  | "neutral";

function resolveOptionReviewState(
  correctIds: Set<string>,
  optionId: string,
  isSelected: boolean,
): OptionReviewState {
  const isCorrectAnswer = correctIds.has(optionId);
  if (isCorrectAnswer && isSelected) return "correct_selected";
  if (isCorrectAnswer && !isSelected) return "correct_missed";
  if (!isCorrectAnswer && isSelected) return "incorrect_selected";
  return "neutral";
}

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

function optionReviewContainerClass(reviewState: OptionReviewState): string {
  switch (reviewState) {
    case "correct_selected":
      return "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
    case "incorrect_selected":
      return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100";
    case "correct_missed":
      return "border-2 border-dashed border-emerald-400 bg-emerald-50/30 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100";
    case "neutral":
      return "opacity-70 bg-card";
  }
}

function imageReviewContainerClass(reviewState: OptionReviewState): string {
  switch (reviewState) {
    case "correct_selected":
      return "ring-4 ring-emerald-500 border-emerald-500";
    case "incorrect_selected":
      return "ring-4 ring-destructive border-destructive";
    case "correct_missed":
      return "border-4 border-dashed border-emerald-400";
    case "neutral":
      return "opacity-70";
  }
}

function TextOptionMissedBadge() {
  const { t } = useLanguage();
  return (
    <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
      {t("quizResult.missed")}
    </span>
  );
}

function ImageOptionReviewBadge({
  reviewState,
}: {
  reviewState: OptionReviewState;
}) {
  const { t } = useLanguage();

  if (reviewState === "correct_selected") {
    return (
      <Badge
        className="absolute top-2 right-2 z-20 gap-1 border-emerald-600/30 bg-emerald-500/95 px-2 py-0.5 text-emerald-50 shadow-md hover:bg-emerald-500/95"
        aria-hidden
      >
        <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
        {t("quizResult.correct")}
      </Badge>
    );
  }

  if (reviewState === "incorrect_selected") {
    return (
      <Badge
        variant="destructive"
        className="absolute top-2 right-2 z-20 gap-1 px-2 py-0.5 shadow-md"
        aria-hidden
      >
        <X className="size-3.5 shrink-0" strokeWidth={2.5} />
        {t("quizResult.incorrect")}
      </Badge>
    );
  }

  if (reviewState === "correct_missed") {
    return (
      <Badge
        variant="outline"
        className="absolute top-2 right-2 z-20 border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 shadow-md dark:text-emerald-200"
        aria-hidden
      >
        {t("quizResult.missed")}
      </Badge>
    );
  }

  return null;
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
  reviewState,
  onSelect,
}: {
  opt: GroupedChoicePlayerOption;
  isSelected: boolean;
  isCorrect: boolean | null;
  isMultiple: boolean;
  isReviewMode: boolean;
  reviewState: OptionReviewState | null;
  onSelect: () => void;
}) {
  const imageUrl = opt.image_url?.trim() ?? "";
  const hasText = Boolean(opt.text.trim());

  const showPlayerIndicator = !isReviewMode;

  const indicator = showPlayerIndicator ? (
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
  ) : null;

  const imageBlock = (
    <div className="relative">
      {reviewState ? <ImageOptionReviewBadge reviewState={reviewState} /> : null}
      {indicator}
      <div className="aspect-square w-full overflow-hidden bg-slate-50 dark:bg-slate-900/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="size-full object-contain"
        />
      </div>
    </div>
  );

  const cardBody = (
    <>
      {imageBlock}
      {hasText ? (
        <div className="px-3 py-2 text-center text-sm leading-snug md:text-base">
          <TaskMediaRenderer html={opt.text} isReviewMode={isReviewMode} />
        </div>
      ) : null}
    </>
  );

  const reviewSurfaceClass =
    isReviewMode && reviewState
      ? cn("border bg-card", imageReviewContainerClass(reviewState))
      : optionLabelClass(isSelected, isCorrect);

  if (isMultiple) {
    return (
      <label
        className={cn(
          "relative block cursor-pointer overflow-hidden rounded-xl border transition-colors",
          reviewSurfaceClass,
          !isReviewMode && isSelected && "ring-primary/30 ring-2",
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
        reviewSurfaceClass,
        !isReviewMode && isSelected && "ring-primary/30 ring-2",
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
  reviewState,
  onSelect,
}: {
  opt: GroupedChoicePlayerOption;
  isSelected: boolean;
  isCorrect: boolean | null;
  isMultiple: boolean;
  isReviewMode: boolean;
  reviewState: OptionReviewState | null;
  onSelect: () => void;
}) {
  const reviewSurfaceClass =
    isReviewMode && reviewState
      ? optionReviewContainerClass(reviewState)
      : optionLabelClass(isSelected, isCorrect);

  if (isMultiple) {
    return (
      <label
        className={cn(
          "border-input hover:bg-muted/60 focus-within:ring-ring flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors focus-within:ring-2 md:min-h-12",
          reviewSurfaceClass,
          !isReviewMode && isSelected && "ring-primary/30 ring-2",
          isReviewMode && "cursor-default",
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isReviewMode}
          onChange={onSelect}
          className="border-input text-primary size-5 shrink-0 rounded"
        />
        <span className="min-w-0 flex-1 text-left text-base leading-snug md:text-lg">
          <TaskMediaRenderer html={opt.text} isReviewMode={isReviewMode} />
        </span>
        {reviewState === "correct_missed" ? <TextOptionMissedBadge /> : null}
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
        "border-input hover:bg-muted/60 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition-colors focus-visible:ring-2 focus-visible:outline-none md:min-h-12 md:text-lg",
        reviewSurfaceClass,
        !isReviewMode && isSelected && "ring-primary/30 ring-2",
        isReviewMode && "cursor-default",
      )}
    >
      <span className="min-w-0 flex-1">
        <TaskMediaRenderer html={opt.text} isReviewMode={isReviewMode} />
      </span>
      {reviewState === "correct_missed" ? <TextOptionMissedBadge /> : null}
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
  reviewItemScores,
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
              {isReviewMode && reviewItemScores?.[item.id] ? (
                <ReviewSubQuestionHeader
                  index={index}
                  earnedPoints={reviewItemScores[item.id]!.earned}
                  maxPoints={reviewItemScores[item.id]!.max}
                  isCorrect={reviewItemScores[item.id]!.isCorrect}
                  pendingReview={reviewItemScores[item.id]!.pendingReview}
                />
              ) : items.length > 1 ? (
                <p className="mb-4 font-medium text-slate-500 dark:text-slate-400">
                  Вопрос {index + 1}
                </p>
              ) : null}
              <TaskMediaRenderer
                html={item.text}
                className="text-foreground text-lg font-medium leading-snug md:text-xl [&_strong]:font-semibold"
                isReviewMode={isReviewMode}
              />
            </div>
            <div
              className={cn(
                useImageGrid
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex w-full flex-col gap-3",
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
                const optionReviewState =
                  isReviewMode && correctByItemId
                    ? resolveOptionReviewState(correctIds, opt.id, isSelected)
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
                      reviewState={optionReviewState}
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
                    reviewState={optionReviewState}
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
