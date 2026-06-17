import type { SafeTestQuestion } from "@/app/actions/test-actions";
import {
  buildAssignmentsFromLabelPairs,
  parseImageLabelingOptions,
} from "@/components/quiz/ImageLabelingQuestion";
import {
  hasGroupedFillTypingContent,
  mergeGroupedTypingRecords,
} from "@/lib/grouped-fill-blanks-utils";
import {
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillTypingFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import {
  groupedCorrectMapFromContent,
  isGroupedChoiceContent,
  parseGroupedSelectionsFromAnswerData,
} from "@/lib/grouped-choice-utils";
import {
  groupedCorrectOrderingMapFromContent,
  parseOrderingAssignmentsFromAnswerData,
} from "@/lib/ordering-utils";
import type { Json } from "@/types/database.types";

function isChoiceReviewType(type: string | null | undefined): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "multiple"
  );
}

/** Верные ответы для grouped choice и ordering (для подсветки в QuizResultView). */
export function buildGroupedCorrectByQuestionId(
  questions: SafeTestQuestion[],
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const q of questions) {
    if (q.type === "ordering") {
      const map = groupedCorrectOrderingMapFromContent(q.content);
      if (map) out[q.id] = map;
      continue;
    }
    if (isChoiceReviewType(q.type) && isGroupedChoiceContent(q.content)) {
      const map = groupedCorrectMapFromContent(q.content);
      if (map) out[q.id] = map;
    }
  }
  return out;
}

/** Одна строка ответа попытки + справочно верные option id по вопросу (как в `getAttemptReviewAnswers`). */
export type ReviewAnswerRow = {
  question_id: string;
  /** Для не-choice часто пустая строка, если в БД нет привязки к варианту. */
  option_id: string;
  answer_data: Json | null;
  correct_option_ids: string[];
};

/**
 * JSONB иногда приходит строкой или даже несколько раз stringified (`"{""labelPairs"":...}"`).
 * Распаковываем до объекта/массива, не более 3 итераций.
 */
function normalizeAnswerData(raw: Json | null): Json | null {
  if (raw == null) return null;
  let parsed: unknown = raw;
  let depth = 0;
  while (typeof parsed === "string" && depth < 3) {
    try {
      const next = JSON.parse(parsed) as unknown;
      parsed = next;
    } catch {
      return null;
    }
    depth++;
  }
  if (typeof parsed === "string") {
    return null;
  }
  return parsed as Json;
}

export type ReviewMaps = {
  reviewRowsByQuestionId: Map<
    string,
    { option_id: string; answer_data: Json | null }[]
  >;
  reviewCorrectIdsByQuestionId: Map<string, string[]>;
  reviewFillByQuestionId: Map<string, Record<string, string>>;
  reviewGroupedFillTypingByQuestionId: Map<
    string,
    Record<string, Record<string, string>>
  >;
  reviewGroupedFillAssignmentsByQuestionId: Map<
    string,
    Record<string, Record<string, string>>
  >;
  reviewAnswersByQuestionId: Map<string, Record<string, string | null>>;
  reviewGroupedSelectionsByQuestionId: Map<string, Record<string, string[]>>;
  reviewGroupedCorrectByQuestionId: Map<string, Record<string, string[]>>;
  reviewOrderingAssignmentsByQuestionId: Map<string, Record<string, string[]>>;
};

/**
 * Строит четыре Map для `QuizResultView` из сырых ответов попытки.
 * Безопасно игнорирует битый `answer_data` (парсеры возвращают null).
 */
export function buildReviewMaps(
  reviewAnswers: ReviewAnswerRow[],
  questions: SafeTestQuestion[],
  groupedCorrectByQuestionId: Record<string, Record<string, string[]>> = {},
): ReviewMaps {
  const reviewAnswersByQuestionId = new Map<
    string,
    Record<string, string | null>
  >();
  const reviewFillByQuestionId = new Map<string, Record<string, string>>();
  const reviewGroupedFillTypingByQuestionId = new Map<
    string,
    Record<string, Record<string, string>>
  >();
  const reviewGroupedFillAssignmentsByQuestionId = new Map<
    string,
    Record<string, Record<string, string>>
  >();
  const reviewGroupedSelectionsByQuestionId = new Map<
    string,
    Record<string, string[]>
  >();
  const reviewGroupedCorrectByQuestionId = new Map<
    string,
    Record<string, string[]>
  >();
  const reviewOrderingAssignmentsByQuestionId = new Map<
    string,
    Record<string, string[]>
  >();
  const reviewRowsByQuestionId = new Map<
    string,
    { option_id: string; answer_data: Json | null }[]
  >();
  const reviewCorrectIdsByQuestionId = new Map<string, string[]>();

  for (const row of reviewAnswers) {
    if (!row.question_id) continue;

    const parsedData = normalizeAnswerData(row.answer_data);
    const optionId = row.option_id?.trim() ? row.option_id : "";

    const list = reviewRowsByQuestionId.get(row.question_id) ?? [];
    list.push({
      option_id: optionId,
      answer_data: parsedData,
    });
    reviewRowsByQuestionId.set(row.question_id, list);
    reviewCorrectIdsByQuestionId.set(
      row.question_id,
      Array.isArray(row.correct_option_ids) ? row.correct_option_ids : [],
    );

    const pairs = parseLabelPairsFromAnswerData(parsedData);
    if (pairs) {
      const q = questions.find((x) => x.id === row.question_id);
      if (q?.type === "image_labeling") {
        try {
          const meta = parseImageLabelingOptions(q.options);
          const imageIds = meta.images.map((i) => i.id);
          const built = buildAssignmentsFromLabelPairs(pairs, imageIds);
          const hasAssignment = Object.values(built).some(
            (v) => v != null && v !== "",
          );
          if (hasAssignment) {
            reviewAnswersByQuestionId.set(row.question_id, built);
          }
        } catch {
          /* пропускаем повреждённый контент вопроса */
        }
      }
    }

    const groupedAssignments =
      parseGroupedFillAssignmentsFromAnswerData(parsedData);
    if (groupedAssignments && Object.keys(groupedAssignments).length > 0) {
      const q = questions.find((x) => x.id === row.question_id);
      if (
        q?.type === "fill_in_the_blanks" ||
        q?.type === "fill_in_the_blanks_multi"
      ) {
        const prev =
          reviewGroupedFillAssignmentsByQuestionId.get(row.question_id) ?? {};
        reviewGroupedFillAssignmentsByQuestionId.set(row.question_id, {
          ...prev,
          ...groupedAssignments,
        });
      }
    }

    const groupedTyping = parseGroupedFillTypingFromAnswerData(parsedData);
    if (hasGroupedFillTypingContent(groupedTyping ?? undefined)) {
      const q = questions.find((x) => x.id === row.question_id);
      if (
        q?.type === "fill_blanks_typing" ||
        q?.type === "fill_blanks_typing_multi" ||
        q?.type === "text_input"
      ) {
        const prev =
          reviewGroupedFillTypingByQuestionId.get(row.question_id) ?? {};
        reviewGroupedFillTypingByQuestionId.set(
          row.question_id,
          mergeGroupedTypingRecords(prev, groupedTyping),
        );
      }
    }

    const grouped = parseGroupedSelectionsFromAnswerData(parsedData);
    if (grouped && Object.keys(grouped).length > 0) {
      const q = questions.find((x) => x.id === row.question_id);
      if (q && isChoiceReviewType(q.type)) {
        const prev = reviewGroupedSelectionsByQuestionId.get(row.question_id) ?? {};
        reviewGroupedSelectionsByQuestionId.set(row.question_id, {
          ...prev,
          ...grouped,
        });
      }
    }

    const orderingAssignments = parseOrderingAssignmentsFromAnswerData(parsedData);
    if (orderingAssignments && Object.keys(orderingAssignments).length > 0) {
      const q = questions.find((x) => x.id === row.question_id);
      if (q?.type === "ordering") {
        const prev =
          reviewOrderingAssignmentsByQuestionId.get(row.question_id) ?? {};
        reviewOrderingAssignmentsByQuestionId.set(row.question_id, {
          ...prev,
          ...orderingAssignments,
        });
      }
    }
  }

  for (const [questionId, correctMap] of Object.entries(
    groupedCorrectByQuestionId,
  )) {
    reviewGroupedCorrectByQuestionId.set(questionId, correctMap);
  }

  return {
    reviewRowsByQuestionId,
    reviewCorrectIdsByQuestionId,
    reviewFillByQuestionId,
    reviewGroupedFillTypingByQuestionId,
    reviewGroupedFillAssignmentsByQuestionId,
    reviewAnswersByQuestionId,
    reviewGroupedSelectionsByQuestionId,
    reviewGroupedCorrectByQuestionId,
    reviewOrderingAssignmentsByQuestionId,
  };
}
