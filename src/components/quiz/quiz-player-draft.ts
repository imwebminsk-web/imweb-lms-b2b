import {
  submitAnswer,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import {
  isGroupedFillBlanksTaskComplete,
  resolveGroupedFillBlanksPlayerView,
} from "@/lib/grouped-fill-blanks-utils";
import {
  resolveGroupedChoicePlayerView,
  LEGACY_GROUPED_ITEM_ID,
} from "@/lib/grouped-choice-utils";
import { resolveOrderingPlayerView } from "@/lib/ordering-utils";
import type { Json } from "@/types/database.types";

import { isGroupedChoiceSelectionComplete } from "./GroupedChoiceTaskQuestion";
import {
  imageLabelingPairsFromAssignments,
  isImageLabelingComplete,
  parseImageLabelingOptions,
} from "./ImageLabelingQuestion";
import type { DndMatchingPair } from "./DndMatchingPuzzleQuestion";
import type { MatchingPair } from "./MatchingPuzzleQuestion";
import { isOrderingSelectionComplete } from "./OrderingTaskQuestion";

export type QuestionDraft = {
  puzzlePairs: (MatchingPair | DndMatchingPair)[];
  labelAssignments: Record<string, string | null>;
  groupedFillAssignments: Record<string, Record<string, string>>;
  groupedFillTyping: Record<string, Record<string, string>>;
  groupedSelections: Record<string, string[]>;
  orderingAssignments: Record<string, string[]>;
};

export function emptyQuestionDraft(): QuestionDraft {
  return {
    puzzlePairs: [],
    labelAssignments: {},
    groupedFillAssignments: {},
    groupedFillTyping: {},
    groupedSelections: {},
    orderingAssignments: {},
  };
}

function isMultipleChoice(type: string | null | undefined): boolean {
  return type === "multiple_choice" || type === "multiple";
}

function isChoiceQuestionType(type: string | null | undefined): boolean {
  return type === "single_choice" || type === "multiple_choice" || type === "multiple";
}

export function canSubmitQuestionDraft(
  question: SafeTestQuestion,
  draft: QuestionDraft,
): boolean {
  const type = question.type;
  const isClickPuzzle = type === "matching_puzzle";
  const isDndPuzzle = type === "dnd_puzzle";
  const isImageLabeling = type === "image_labeling";
  const isFillInTheBlanks =
    type === "fill_in_the_blanks" || type === "fill_in_the_blanks_multi";
  const isFillBlanksTyping =
    type === "fill_blanks_typing" || type === "fill_blanks_typing_multi";
  const isTextInput = type === "text_input";
  const isOrdering = type === "ordering";
  const isChoiceQuestion = isChoiceQuestionType(type);
  const isAnyGroupedFillBlanks =
    isFillInTheBlanks || isFillBlanksTyping || isTextInput;
  const optionCount = question.options.length;

  if (isClickPuzzle || isDndPuzzle) {
    return optionCount > 0 && draft.puzzlePairs.length === optionCount;
  }

  if (isImageLabeling) {
    const meta = parseImageLabelingOptions(question.options);
    const merged = Object.fromEntries(
      meta.images.map((i) => [i.id, draft.labelAssignments[i.id] ?? null] as const),
    );
    return (
      meta.images.length > 0 &&
      isImageLabelingComplete(merged, meta.images.map((i) => i.id))
    );
  }

  if (isAnyGroupedFillBlanks) {
    const view = resolveGroupedFillBlanksPlayerView({
      content: question.content as Json,
      questionType: type,
    });
    if (!view) return false;
    return isGroupedFillBlanksTaskComplete(view, draft);
  }

  if (isChoiceQuestion) {
    const playerView = resolveGroupedChoicePlayerView({
      content: question.content,
      questionType: type,
      legacyOptions: question.options,
    });
    return isGroupedChoiceSelectionComplete(
      playerView.items,
      draft.groupedSelections,
      isMultipleChoice(type),
    );
  }

  if (isOrdering) {
    const playerView = resolveOrderingPlayerView({
      content: question.content,
    });
    if (!playerView) return false;
    return isOrderingSelectionComplete(
      playerView.items,
      draft.orderingAssignments,
    );
  }

  return false;
}

/** True when every question is already submitted or has a complete draft. */
export function isQuizFullyAnswered(
  questions: SafeTestQuestion[],
  drafts: Record<string, QuestionDraft>,
  submittedQuestionIds: Set<string>,
): boolean {
  return questions.every((question) => {
    if (submittedQuestionIds.has(question.id)) return true;
    const draft = drafts[question.id] ?? emptyQuestionDraft();
    return canSubmitQuestionDraft(question, draft);
  });
}

/**
 * Следующий вопрос без отправленного ответа: сначала после текущего, затем с начала.
 * Возвращает null, если все вопросы уже отправлены.
 */
export function findNextUnansweredQuestionIndex(
  questions: SafeTestQuestion[],
  currentIndex: number,
  submittedQuestionIds: Set<string>,
): number | null {
  if (questions.length === 0) return null;

  const isUnanswered = (index: number): boolean => {
    const question = questions[index];
    if (!question) return false;
    return !submittedQuestionIds.has(question.id);
  };

  for (let i = currentIndex + 1; i < questions.length; i++) {
    if (isUnanswered(i)) return i;
  }
  for (let i = 0; i < currentIndex; i++) {
    if (isUnanswered(i)) return i;
  }
  return null;
}

export async function submitQuestionDraft(
  attemptId: string,
  question: SafeTestQuestion,
  draft: QuestionDraft,
): Promise<{ success: true } | { success: false; error: string }> {
  const type = question.type;
  const isClickPuzzle = type === "matching_puzzle";
  const isDndPuzzle = type === "dnd_puzzle";
  const isImageLabeling = type === "image_labeling";
  const isFillInTheBlanks =
    type === "fill_in_the_blanks" || type === "fill_in_the_blanks_multi";
  const isFillBlanksTyping =
    type === "fill_blanks_typing" || type === "fill_blanks_typing_multi";
  const isTextInput = type === "text_input";
  const isOrdering = type === "ordering";
  const isChoiceQuestion = isChoiceQuestionType(type);
  const isAnyGroupedFillBlanks =
    isFillInTheBlanks || isFillBlanksTyping || isTextInput;
  const multiple = isMultipleChoice(type);

  if (isClickPuzzle) {
    return submitAnswer(attemptId, question.id, undefined, {
      matchingPairs: draft.puzzlePairs as MatchingPair[],
    });
  }

  if (isDndPuzzle) {
    return submitAnswer(attemptId, question.id, undefined, {
      pairs: draft.puzzlePairs as DndMatchingPair[],
    });
  }

  if (isImageLabeling) {
    const meta = parseImageLabelingOptions(question.options);
    const merged = Object.fromEntries(
      meta.images.map((i) => [i.id, draft.labelAssignments[i.id] ?? null] as const),
    );
    return submitAnswer(attemptId, question.id, undefined, {
      labelPairs: imageLabelingPairsFromAssignments(
        merged,
        meta.images.map((i) => i.id),
      ),
    });
  }

  if (isAnyGroupedFillBlanks) {
    const view = resolveGroupedFillBlanksPlayerView({
      content: question.content as Json,
      questionType: type,
    });
    if (!view) {
      return { success: false, error: "Не удалось разобрать вопрос с пропусками" };
    }
    return view.mode === "dnd"
      ? submitAnswer(attemptId, question.id, undefined, {
          groupedFillAssignments: draft.groupedFillAssignments,
        })
      : submitAnswer(attemptId, question.id, undefined, {
          groupedFillTyping: draft.groupedFillTyping,
        });
  }

  if (isChoiceQuestion) {
    const playerView = resolveGroupedChoicePlayerView({
      content: question.content,
      questionType: type,
      legacyOptions: question.options,
    });
    return playerView.isGrouped
      ? submitAnswer(attemptId, question.id, undefined, {
          groupedSelections: draft.groupedSelections,
        })
      : submitAnswer(
          attemptId,
          question.id,
          multiple
            ? (draft.groupedSelections[LEGACY_GROUPED_ITEM_ID] ?? [])
            : draft.groupedSelections[LEGACY_GROUPED_ITEM_ID]?.[0],
        );
  }

  if (isOrdering) {
    return submitAnswer(attemptId, question.id, undefined, {
      orderingAssignments: draft.orderingAssignments,
    });
  }

  return { success: false, error: "Неподдерживаемый тип задания" };
}
