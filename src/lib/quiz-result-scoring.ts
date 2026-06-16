import type { SafeTestQuestion } from "@/app/actions/test-actions";
import {
  countCorrectDnDBlanksInItem,
  countCorrectTypingBlanksInItem,
  resolveBlankIdsForGroupedFillBlanksItem,
  resolveGroupedFillBlanksPlayerView,
  type GroupedFillBlanksMode,
} from "@/lib/grouped-fill-blanks-utils";
import {
  buildLegacyGroupedItem,
  GROUPED_CHOICE_ANCHOR_TEXT,
  isGroupedItemAnswerCorrect,
  LEGACY_GROUPED_ITEM_ID,
  parseGroupedChoiceItems,
} from "@/lib/grouped-choice-utils";
import {
  isOrderingItemAnswerCorrect,
  parseOrderingItems,
} from "@/lib/ordering-utils";
import { parseManualItemGradesFromAnswerData } from "@/lib/manual-grading-utils";
import type { Json } from "@/types/database.types";
import { resolveQuestionPoints } from "@/lib/utils/grading";
import {
  getAttemptQuestionEarnedPoints,
  pickRepresentativeAttemptAnswerRow,
  resolveQuestionMaxPoints,
} from "@/lib/utils/scoring-utils";

export type ReviewItemScore = {
  earned: number;
  max: number;
  isCorrect: boolean;
  pendingReview?: boolean;
};

function pickAnswerDataFromRows(
  rows: { option_id: string; answer_data: Json | null }[],
): Json | null {
  for (const row of rows) {
    if (row.answer_data == null) continue;
    return row.answer_data;
  }
  return null;
}

export function resolveTaskPointsForReview(
  q: SafeTestQuestion,
  rows: { option_id: string; answer_data: Json | null }[],
  correctIdsByQuestion: Map<string, string[]>,
): { earned: number; max: number } {
  const allOptions = q.options.map((option) => ({
    id: option.id,
    question_id: q.id,
    is_correct: (correctIdsByQuestion.get(q.id) ?? []).includes(option.id),
    content: option.content,
  }));

  const answerRow = pickRepresentativeAttemptAnswerRow(q.type, rows);
  const earned = getAttemptQuestionEarnedPoints(
    { id: q.id, type: q.type, content: q.content, points: q.points },
    answerRow,
    allOptions,
    correctIdsByQuestion,
  );
  const max = resolveQuestionMaxPoints(
    { id: q.id, type: q.type, content: q.content, points: q.points },
    allOptions,
  );

  return { earned, max };
}

export function resolveGroupedChoiceItemScores(params: {
  question: SafeTestQuestion;
  selections: Record<string, string[]>;
  correctByItemId?: Record<string, string[]>;
}): Record<string, ReviewItemScore> {
  const parsedItems = parseGroupedChoiceItems(params.question.content);
  let resolvedItems = parsedItems;

  if (!resolvedItems && params.question.options.length > 0) {
    const legacyCorrect = params.correctByItemId?.[LEGACY_GROUPED_ITEM_ID] ?? [];
    const legacyMax = resolveQuestionMaxPoints(
      {
        id: params.question.id,
        type: params.question.type,
        content: params.question.content,
      },
      params.question.options.map((o) => ({
        id: o.id,
        question_id: params.question.id,
        content: o.content,
      })),
    );
    resolvedItems = [
      buildLegacyGroupedItem({
        text: "",
        points: legacyMax,
        options: params.question.options
          .filter((o) => {
            const rec = o.content as { text?: unknown };
            return rec.text !== GROUPED_CHOICE_ANCHOR_TEXT;
          })
          .map((o) => {
            const rec = o.content as { text?: unknown; image_url?: unknown };
            return {
              id: o.id,
              text: typeof rec.text === "string" ? rec.text : "",
              is_correct: legacyCorrect.includes(o.id),
              ...(typeof rec.image_url === "string" && rec.image_url.trim()
                ? { image_url: rec.image_url.trim() }
                : {}),
            };
          }),
      }),
    ];
  }

  const out: Record<string, ReviewItemScore> = {};
  if (!resolvedItems) return out;

  for (const item of resolvedItems) {
    const max = resolveQuestionPoints(item.points);
    const selected = params.selections[item.id] ?? [];
    const earned = isGroupedItemAnswerCorrect(
      item,
      selected,
      params.question.type,
    )
      ? max
      : 0;
    out[item.id] = {
      earned,
      max,
      isCorrect: max > 0 && earned >= max,
    };
  }

  return out;
}

export function resolveOrderingItemScores(params: {
  content: Json;
  assignments: Record<string, string[]>;
}): Record<string, ReviewItemScore> {
  const items = parseOrderingItems(params.content);
  const out: Record<string, ReviewItemScore> = {};
  if (!items) return out;

  for (const item of items) {
    const max = resolveQuestionPoints(item.points);
    const submitted = params.assignments[item.id] ?? [];
    const earned = isOrderingItemAnswerCorrect(item, submitted) ? max : 0;
    out[item.id] = {
      earned,
      max,
      isCorrect: max > 0 && earned >= max,
    };
  }

  return out;
}

export function resolveGroupedFillItemScores(params: {
  question: SafeTestQuestion;
  mode: GroupedFillBlanksMode;
  groupedAssignments?: Record<string, Record<string, string>>;
  groupedTyping?: Record<string, Record<string, string>>;
  manualGrades?: Record<string, number> | null;
  pendingReview?: boolean;
}): Record<string, ReviewItemScore> {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.question.content,
    questionType: params.question.type,
  });
  const out: Record<string, ReviewItemScore> = {};
  if (!view) return out;

  for (const item of view.items) {
    const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
    const unit = resolveQuestionPoints(item.points);
    const max = Math.max(blankIds.length, 1) * unit;

    if (params.question.type === "text_input") {
      const earned = params.manualGrades?.[item.id] ?? 0;
      out[item.id] = {
        earned,
        max: resolveQuestionPoints(item.points),
        isCorrect: !params.pendingReview && earned >= resolveQuestionPoints(item.points),
        pendingReview: params.pendingReview,
      };
      continue;
    }

    if (params.mode === "dnd") {
      const itemAssignments = params.groupedAssignments?.[item.id] ?? {};
      const correctBlanks = countCorrectDnDBlanksInItem(item, itemAssignments);
      const earned = correctBlanks * unit;
      out[item.id] = {
        earned,
        max,
        isCorrect: max > 0 && earned >= max,
      };
      continue;
    }

    const itemTyping = params.groupedTyping?.[item.id] ?? {};
    const correctBlanks = countCorrectTypingBlanksInItem(item, itemTyping);
    const earned = correctBlanks * unit;
    out[item.id] = {
      earned,
      max,
      isCorrect: max > 0 && earned >= max,
    };
  }

  return out;
}

export function parseManualGradesFromRows(
  rows: { option_id: string; answer_data: Json | null }[],
): Record<string, number> | null {
  return parseManualItemGradesFromAnswerData(pickAnswerDataFromRows(rows));
}
