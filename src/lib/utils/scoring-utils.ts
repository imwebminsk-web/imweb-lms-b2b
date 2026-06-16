import {
  isGapFillPartialScoringQuestionType,
  isGroupedFillBlanksFullyCorrect,
  isGroupedFillInTheBlanksFullyCorrect,
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillTypingFromAnswerData,
  resolveGroupedFillBlanksQuestionMaxPoints,
  scoreGroupedFillInTheBlanksQuestion,
  scoreGroupedFillBlanksTypingQuestion,
} from "@/lib/grouped-fill-blanks-utils";
import {
  isGroupedChoiceContent,
  parseGroupedChoiceItems,
  parseGroupedSelectionsFromAnswerData,
  scoreGroupedChoiceQuestion,
  sumGroupedItemPoints,
} from "@/lib/grouped-choice-utils";
import {
  parseOrderingAssignmentsFromAnswerData,
  parseOrderingItems,
  scoreOrderingQuestion,
  sumOrderingItemPoints,
} from "@/lib/ordering-utils";
import {
  parseManualItemGradesFromAnswerData,
  sumManualItemGrades,
} from "@/lib/manual-grading-utils";
import { parseLabelPairsFromAnswerData } from "@/lib/quiz-helpers";
import { resolveQuestionPoints } from "@/lib/utils/grading";
import type { Json } from "@/types/database.types";

export { isGapFillPartialScoringQuestionType } from "@/lib/grouped-fill-blanks-utils";

export function isPartialPairScoringType(type: string | null): boolean {
  return (
    type === "matching_puzzle" ||
    type === "dnd_puzzle" ||
    type === "image_labeling"
  );
}

export function countPartialPairScoringUnits(
  questionType: string | null,
  optionsForQuestion: { id: string; content: Json | null }[],
): number {
  if (questionType === "matching_puzzle" || questionType === "dnd_puzzle") {
    return Math.max(optionsForQuestion.length, 1);
  }
  if (questionType === "image_labeling") {
    const pairCount = getImageLabelingPairOptionIds(optionsForQuestion).size;
    return Math.max(pairCount, 1);
  }
  return 1;
}

export function resolveQuestionMaxPoints(
  q: {
    id: string;
    type: string | null;
    points?: number | null;
    content?: Json | null;
  },
  allOptions: { id: string; question_id: string; content: Json | null }[],
): number {
  if (isGapFillPartialScoringQuestionType(q.type)) {
    return resolveGroupedFillBlanksQuestionMaxPoints({
      content: q.content ?? null,
      questionType: q.type,
      questionPoints: q.points,
    });
  }

  if (q.type === "ordering") {
    const items = parseOrderingItems(q.content ?? null);
    if (items) {
      return sumOrderingItemPoints(items);
    }
  }

  if (
    q.type === "single_choice" ||
    q.type === "multiple_choice" ||
    q.type === "multiple"
  ) {
    if (isGroupedChoiceContent(q.content ?? null)) {
      const items = parseGroupedChoiceItems(q.content ?? null);
      if (items) {
        return sumGroupedItemPoints(items);
      }
    }
    return resolveQuestionPoints(q.points);
  }

  const unitPoints = resolveQuestionPoints(q.points);
  if (!isPartialPairScoringType(q.type)) {
    return unitPoints;
  }
  const optionsForQuestion = allOptions.filter((o) => o.question_id === q.id);
  return unitPoints * countPartialPairScoringUnits(q.type, optionsForQuestion);
}

export function sumQuestionsMaxPoints(
  questions: {
    id: string;
    type: string | null;
    points?: number | null;
    content?: Json | null;
  }[],
  allOptions: { id: string; question_id: string; content: Json | null }[],
): number {
  return questions.reduce(
    (sum, q) => sum + resolveQuestionMaxPoints(q, allOptions),
    0,
  );
}

function scoreMatchingPuzzlePoints(
  q: { id: string; type?: string | null; points?: number | null },
  answerRow:
    | { option_id: string | null; answer_data: Json | null }
    | undefined,
  allOptions: { id: string; question_id: string; content: Json | null }[],
): number {
  const pairs = parsePairAssignmentsFromAnswerData(answerRow?.answer_data ?? null);
  if (!pairs) return 0;

  const unitPoints = resolveQuestionPoints(q.points);
  const optionsForQuestion = allOptions.filter((o) => o.question_id === q.id);
  let correctMatches = 0;
  for (const leftOpt of optionsForQuestion) {
    const pair = pairs.find((p) => p.leftOptionId === leftOpt.id);
    if (pair && pair.rightOptionId === leftOpt.id) {
      correctMatches += 1;
    }
  }

  return correctMatches * unitPoints;
}

function scoreImageLabelingPoints(
  q: { id: string; points?: number | null },
  answerRow:
    | { option_id: string | null; answer_data: Json | null }
    | undefined,
  allOptions: {
    id: string;
    question_id: string;
    content: Json | null;
  }[],
): number {
  const qopts = allOptions.filter((o) => o.question_id === q.id);
  const pairIds = getImageLabelingPairOptionIds(qopts);
  if (pairIds.size === 0) return 0;
  const labelPairs = parseLabelPairsFromAnswerData(answerRow?.answer_data ?? null);
  if (!labelPairs) return 0;
  const unitPoints = resolveQuestionPoints(q.points);
  const byImage = new Map(labelPairs.map((p) => [p.imageId, p.wordId]));
  let correctMatches = 0;
  for (const pairId of pairIds) {
    if (byImage.get(pairId) === pairId) {
      correctMatches += 1;
    }
  }
  return correctMatches * unitPoints;
}

/** Пара в одной строке: `imageUrl` + эталонная подпись (`correctText` или `correctWord`). */
function isImageLabelingPairRow(content: Json | null): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  const rec = content as Record<string, unknown>;
  const imageUrl = rec.imageUrl;
  const correct =
    typeof rec.correctText === "string"
      ? rec.correctText
      : typeof rec.correctWord === "string"
        ? rec.correctWord
        : "";
  return (
    typeof imageUrl === "string" &&
    imageUrl.length > 0 &&
    correct.length > 0
  );
}

export function getImageLabelingPairOptionIds(
  rows: { id: string; content: Json | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const o of rows) {
    if (isImageLabelingPairRow(o.content)) ids.add(o.id);
  }
  return ids;
}

export function validateMatchingPairsStructure(
  pairs: { leftOptionId: string; rightOptionId: string }[],
  validIds: Set<string>,
): boolean {
  if (pairs.length !== validIds.size || validIds.size === 0) {
    return false;
  }
  const leftUsed = new Set<string>();
  const rightUsed = new Set<string>();
  for (const p of pairs) {
    if (!validIds.has(p.leftOptionId) || !validIds.has(p.rightOptionId)) {
      return false;
    }
    if (leftUsed.has(p.leftOptionId) || rightUsed.has(p.rightOptionId)) {
      return false;
    }
    leftUsed.add(p.leftOptionId);
    rightUsed.add(p.rightOptionId);
  }
  return leftUsed.size === validIds.size && rightUsed.size === validIds.size;
}

/** Читает пары из `answer_data`: сначала `pairs` (dnd_puzzle), затем `matchingPairs`. */
export function parsePairAssignmentsFromAnswerData(
  data: Json | null,
): { leftOptionId: string; rightOptionId: string }[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const raw =
    (data as { pairs?: unknown }).pairs ??
    (data as { matchingPairs?: unknown }).matchingPairs;
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: { leftOptionId: string; rightOptionId: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const l = (item as { leftOptionId?: unknown }).leftOptionId;
    const r = (item as { rightOptionId?: unknown }).rightOptionId;
    if (typeof l !== "string" || typeof r !== "string") {
      return null;
    }
    out.push({ leftOptionId: l, rightOptionId: r });
  }
  return out;
}

/**
 * Несколько строк `attempt_answers` на один вопрос (напр. multiple_choice) —
 * берём строку с полным `answer_data.selectedOptionIds`, иначе последнюю.
 */
export function pickRepresentativeAttemptAnswerRow(
  questionType: string | null,
  rowsForQuestion: {
    option_id: string;
    answer_data: Json | null;
  }[],
):
  | { option_id: string; answer_data: Json | null }
  | undefined {
  if (rowsForQuestion.length === 0) {
    return undefined;
  }
  if (rowsForQuestion.length === 1) {
    return rowsForQuestion[0];
  }
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";
  if (!isMultiple) {
    return rowsForQuestion[0];
  }
  const withSel = rowsForQuestion.find((r) => {
    if (!r.answer_data || typeof r.answer_data !== "object") {
      return false;
    }
    if (Array.isArray(r.answer_data)) {
      return false;
    }
    const raw = (r.answer_data as { selectedOptionIds?: unknown })
      .selectedOptionIds;
    return Array.isArray(raw) && raw.length > 0;
  });
  return withSel ?? rowsForQuestion[rowsForQuestion.length - 1];
}

function parseSelectedIdsFromAnswerRow(
  optionId: string,
  answerData: Json | null,
  questionType: string | null,
): string[] {
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";
  if (
    isMultiple &&
    answerData &&
    typeof answerData === "object" &&
    !Array.isArray(answerData)
  ) {
    const raw = (answerData as { selectedOptionIds?: unknown })
      .selectedOptionIds;
    if (Array.isArray(raw)) {
      const ids = raw.filter((x): x is string => typeof x === "string");
      if (ids.length > 0) {
        return [...new Set(ids)];
      }
    }
  }
  return [optionId];
}

function setsOfStringsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sa = new Set(a);
  for (const x of b) {
    if (!sa.has(x)) {
      return false;
    }
  }
  return true;
}

function isAttemptQuestionFullyCorrect(
  q: {
    id: string;
    type: string | null;
    content: Json | null;
    points?: number | null;
  },
  answerRow:
    | { option_id: string | null; answer_data: Json | null }
    | undefined,
  allOptions: {
    id: string;
    question_id: string;
    is_correct: boolean | null;
    content: Json | null;
  }[],
  correctIdsByQuestion: Map<string, string[]>,
): boolean {
  if (!answerRow) return false;

  if (q.type === "text_input") {
    return false;
  }

  if (isGroupedChoiceContent(q.content)) {
    const selections = parseGroupedSelectionsFromAnswerData(
      answerRow.answer_data,
    );
    if (!selections) return false;
    const items = parseGroupedChoiceItems(q.content);
    const total = items
      ? sumGroupedItemPoints(items)
      : resolveQuestionPoints(q.points);
    const earned = scoreGroupedChoiceQuestion({
      content: q.content,
      questionType: q.type,
      selections,
      questionPoints: q.points,
    });
    return earned >= total;
  }

  if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
    const earned = scoreMatchingPuzzlePoints(q, answerRow, allOptions);
    const maxPoints = resolveQuestionMaxPoints(q, allOptions);
    return earned >= maxPoints && maxPoints > 0;
  }

  if (q.type === "image_labeling") {
    const earned = scoreImageLabelingPoints(q, answerRow, allOptions);
    const maxPoints = resolveQuestionMaxPoints(q, allOptions);
    return earned >= maxPoints && maxPoints > 0;
  }

  if (q.type === "fill_in_the_blanks" || q.type === "fill_in_the_blanks_multi") {
    const groupedAssignments = parseGroupedFillAssignmentsFromAnswerData(
      answerRow.answer_data,
    );
    if (!groupedAssignments) return false;
    return isGroupedFillInTheBlanksFullyCorrect({
      content: q.content,
      questionType: q.type,
      groupedAssignments,
      questionPoints: q.points,
    });
  }

  if (q.type === "fill_blanks_typing" || q.type === "fill_blanks_typing_multi") {
    const groupedTyping = parseGroupedFillTypingFromAnswerData(
      answerRow.answer_data,
    );
    if (!groupedTyping) return false;
    return isGroupedFillBlanksFullyCorrect({
      content: q.content,
      questionType: q.type,
      groupedTyping,
      questionPoints: q.points,
    });
  }

  if (q.type === "ordering") {
    const assignments = parseOrderingAssignmentsFromAnswerData(
      answerRow.answer_data,
    );
    if (!assignments) return false;
    const items = parseOrderingItems(q.content);
    const total = items ? sumOrderingItemPoints(items) : resolveQuestionPoints(q.points);
    const earned = scoreOrderingQuestion({
      content: q.content,
      assignments,
    });
    return earned >= total && total > 0;
  }

  const studentIds = parseSelectedIdsFromAnswerRow(
    answerRow.option_id ?? "",
    answerRow.answer_data,
    q.type ?? "single_choice",
  );
  const correctIds = correctIdsByQuestion.get(q.id) ?? [];
  const isMultiple = q.type === "multiple_choice" || q.type === "multiple";

  if (isMultiple) {
    const a = [...new Set(studentIds)].sort();
    const b = [...new Set(correctIds)].sort();
    return setsOfStringsEqual(a, b);
  }

  if (studentIds.length === 1) {
    return correctIds.includes(studentIds[0]);
  }

  return false;
}

/** Задание засчитывается целиком: все пары / пропуски / варианты верны. */
export function getAttemptQuestionEarnedPoints(
  q: {
    id: string;
    type: string | null;
    content: Json | null;
    points?: number | null;
  },
  answerRow:
    | { option_id: string | null; answer_data: Json | null }
    | undefined,
  allOptions: {
    id: string;
    question_id: string;
    is_correct: boolean | null;
    content: Json | null;
  }[],
  correctIdsByQuestion: Map<string, string[]>,
): number {
  if (q.type === "text_input") {
    const manualGrades = parseManualItemGradesFromAnswerData(
      answerRow?.answer_data ?? null,
    );
    if (manualGrades) {
      return sumManualItemGrades(manualGrades);
    }
    return 0;
  }

  if (q.type === "fill_in_the_blanks" || q.type === "fill_in_the_blanks_multi") {
    const groupedAssignments = parseGroupedFillAssignmentsFromAnswerData(
      answerRow?.answer_data ?? null,
    );
    if (!groupedAssignments) return 0;
    return scoreGroupedFillInTheBlanksQuestion({
      content: q.content,
      questionType: q.type,
      groupedAssignments,
      questionPoints: q.points,
    });
  }

  if (q.type === "fill_blanks_typing" || q.type === "fill_blanks_typing_multi") {
    const groupedTyping = parseGroupedFillTypingFromAnswerData(
      answerRow?.answer_data ?? null,
    );
    if (!groupedTyping) return 0;
    return scoreGroupedFillBlanksTypingQuestion({
      content: q.content,
      questionType: q.type,
      groupedTyping,
      questionPoints: q.points,
    });
  }

  if (isGroupedChoiceContent(q.content)) {
    const selections = parseGroupedSelectionsFromAnswerData(
      answerRow?.answer_data ?? null,
    );
    if (!selections) return 0;
    return scoreGroupedChoiceQuestion({
      content: q.content,
      questionType: q.type,
      selections,
      questionPoints: q.points,
    });
  }

  if (q.type === "ordering") {
    const assignments = parseOrderingAssignmentsFromAnswerData(
      answerRow?.answer_data ?? null,
    );
    if (!assignments) return 0;
    return scoreOrderingQuestion({
      content: q.content,
      assignments,
    });
  }

  if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
    return scoreMatchingPuzzlePoints(q, answerRow, allOptions);
  }

  if (q.type === "image_labeling") {
    return scoreImageLabelingPoints(q, answerRow, allOptions);
  }

  if (
    isAttemptQuestionFullyCorrect(
      q,
      answerRow,
      allOptions,
      correctIdsByQuestion,
    )
  ) {
    return resolveQuestionPoints(q.points);
  }

  return 0;
}
