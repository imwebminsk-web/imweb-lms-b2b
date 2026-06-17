"use client";

import { FillBlanksParsedHtmlQuestion } from "@/components/quiz/FillBlanksParsedHtmlQuestion";
import { FillBlanksTypingQuestion } from "@/components/quiz/FillBlanksTypingQuestion";
import { FillInTheBlanksQuestion } from "@/components/quiz/FillInTheBlanksQuestion";
import { TextInputQuestion } from "@/components/quiz/TextInputQuestion";
import { ReviewSubQuestionHeader } from "@/components/quiz/ReviewSubQuestionHeader";
import type { ReviewItemScore } from "@/lib/quiz-result-scoring";
import type {
  GroupedFillBlanksMode,
  GroupedFillBlanksPlayerItem,
} from "@/lib/grouped-fill-blanks-utils";
import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";
import type { TextInputContent } from "@/lib/validations/fill-in-the-blanks-schema";
import type { Json } from "@/types/database.types";
import { cn } from "@/lib/utils";

export type GroupedFillBlanksTaskQuestionProps = {
  items: GroupedFillBlanksPlayerItem[];
  mode: GroupedFillBlanksMode;
  groupedTyping?: Record<string, Record<string, string>>;
  groupedAssignments?: Record<string, Record<string, string>>;
  onTypingChange?: (groupedTyping: Record<string, Record<string, string>>) => void;
  onAssignmentsChange?: (
    groupedAssignments: Record<string, Record<string, string>>,
  ) => void;
  isReviewMode?: boolean;
  reviewItemScores?: Record<string, ReviewItemScore>;
  /** Сырой answer_data попытки — brute-force fallback в review. */
  reviewRawAnswer?: Json | null;
};

function itemToTypingContent(item: GroupedFillBlanksPlayerItem): FillInTheBlanksContent {
  return {
    segments: item.segments,
    wordBank: item.wordBank,
    correctMapping: item.correctMapping,
  };
}

function itemToTextInputContent(item: GroupedFillBlanksPlayerItem): TextInputContent {
  return {
    segments: item.segments,
    wordBank: item.wordBank,
    correctMapping: item.correctMapping,
  };
}

function renderLegacyItem(
  item: GroupedFillBlanksPlayerItem,
  mode: GroupedFillBlanksMode,
  groupedTyping: Record<string, Record<string, string>>,
  groupedAssignments: Record<string, Record<string, string>>,
  isReviewMode: boolean,
  reviewRawAnswer?: Json | null,
  onTypingChange?: (itemId: string, next: Record<string, string>) => void,
  onAssignmentsChange?: (itemId: string, next: Record<string, string>) => void,
) {
  if (mode === "dnd") {
    return (
      <FillInTheBlanksQuestion
        content={itemToTypingContent(item)}
        value={groupedAssignments[item.id] ?? {}}
        onChange={(next) => onAssignmentsChange?.(item.id, next)}
        isReviewMode={isReviewMode}
      />
    );
  }
  if (mode === "text_input") {
    return (
      <TextInputQuestion
        content={itemToTextInputContent(item)}
        value={groupedTyping[item.id] ?? {}}
        reviewRawAnswer={reviewRawAnswer}
        onChange={(next) => onTypingChange?.(item.id, next)}
        isReviewMode={isReviewMode}
      />
    );
  }
  return (
    <FillBlanksTypingQuestion
      content={itemToTypingContent(item)}
      value={groupedTyping[item.id]}
      onChange={(next) => onTypingChange?.(item.id, next)}
      isReviewMode={isReviewMode}
    />
  );
}

export function GroupedFillBlanksTaskQuestion({
  items,
  mode,
  groupedTyping: groupedTypingProp,
  groupedAssignments: groupedAssignmentsProp,
  onTypingChange,
  onAssignmentsChange,
  isReviewMode = false,
  reviewItemScores,
  reviewRawAnswer,
}: GroupedFillBlanksTaskQuestionProps) {
  const groupedTyping = groupedTypingProp ?? {};
  const groupedAssignments = groupedAssignmentsProp ?? {};

  function updateItemTyping(
    itemId: string,
    itemTyping: Record<string, string>,
  ) {
    onTypingChange?.({ ...groupedTyping, [itemId]: itemTyping });
  }

  function updateItemAssignments(
    itemId: string,
    itemAssignments: Record<string, string>,
  ) {
    onAssignmentsChange?.({
      ...groupedAssignments,
      [itemId]: itemAssignments,
    });
  }

  return (
    <div className="flex flex-col">
      <hr
        className="my-8 border-slate-200 dark:border-slate-700"
        aria-hidden
      />
      {items.map((item, index) => (
        <section
          key={item.id}
          className={cn(
            "space-y-2",
            index !== items.length - 1 &&
              "mb-10 border-b border-slate-200 pb-10 dark:border-slate-700",
          )}
        >
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
          {item.parsedHtml ? (
            <FillBlanksParsedHtmlQuestion
              parsedHtml={item.parsedHtml}
              mode={mode}
              segments={item.segments}
              wordBank={item.wordBank}
              correctMapping={item.correctMapping}
              value={
                mode === "dnd"
                  ? (groupedAssignments[item.id] ?? {})
                  : (groupedTyping[item.id] ?? {})
              }
              reviewRawAnswer={reviewRawAnswer}
              onChange={(next) =>
                mode === "dnd"
                  ? updateItemAssignments(item.id, next)
                  : updateItemTyping(item.id, next)
              }
              isReviewMode={isReviewMode}
            />
          ) : (
            renderLegacyItem(
              item,
              mode,
              groupedTyping,
              groupedAssignments,
              isReviewMode,
              reviewRawAnswer,
              updateItemTyping,
              updateItemAssignments,
            )
          )}
        </section>
      ))}
    </div>
  );
}
