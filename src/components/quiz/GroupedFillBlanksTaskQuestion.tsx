"use client";

import { FillBlanksTypingQuestion } from "@/components/quiz/FillBlanksTypingQuestion";
import { FillInTheBlanksQuestion } from "@/components/quiz/FillInTheBlanksQuestion";
import { TextInputQuestion } from "@/components/quiz/TextInputQuestion";
import type {
  GroupedFillBlanksMode,
  GroupedFillBlanksPlayerItem,
} from "@/lib/grouped-fill-blanks-utils";
import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";
import type { TextInputContent } from "@/lib/validations/fill-in-the-blanks-schema";

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

export function GroupedFillBlanksTaskQuestion({
  items,
  mode,
  groupedTyping: groupedTypingProp,
  groupedAssignments: groupedAssignmentsProp,
  onTypingChange,
  onAssignmentsChange,
  isReviewMode = false,
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
    <div className="flex flex-col gap-6">
      {items.map((item, index) => (
        <section key={item.id} className="space-y-2">
          {items.length > 1 ? (
            <p className="text-muted-foreground text-sm font-medium">
              Вопрос {index + 1}
            </p>
          ) : null}
          {mode === "dnd" ? (
            <FillInTheBlanksQuestion
              content={itemToTypingContent(item)}
              value={groupedAssignments[item.id]}
              onChange={(next) => updateItemAssignments(item.id, next)}
              isReviewMode={isReviewMode}
            />
          ) : mode === "text_input" ? (
            <TextInputQuestion
              content={itemToTextInputContent(item)}
              value={groupedTyping[item.id]}
              onChange={(next) => updateItemTyping(item.id, next)}
              isReviewMode={isReviewMode}
            />
          ) : (
            <FillBlanksTypingQuestion
              content={itemToTypingContent(item)}
              value={groupedTyping[item.id]}
              onChange={(next) => updateItemTyping(item.id, next)}
              isReviewMode={isReviewMode}
            />
          )}
        </section>
      ))}
    </div>
  );
}
