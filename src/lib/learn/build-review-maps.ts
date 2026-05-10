import type { SafeTestQuestion } from "@/app/actions/test-actions";
import {
  buildAssignmentsFromLabelPairs,
  parseImageLabelingOptions,
} from "@/components/quiz/ImageLabelingQuestion";
import {
  parseFillAssignmentsFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import type { Json } from "@/types/database.types";

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
  reviewAnswersByQuestionId: Map<string, Record<string, string | null>>;
};

/**
 * Строит четыре Map для `QuizResultView` из сырых ответов попытки.
 * Безопасно игнорирует битый `answer_data` (парсеры возвращают null).
 */
export function buildReviewMaps(
  reviewAnswers: ReviewAnswerRow[],
  questions: SafeTestQuestion[],
): ReviewMaps {
  const reviewAnswersByQuestionId = new Map<
    string,
    Record<string, string | null>
  >();
  const reviewFillByQuestionId = new Map<string, Record<string, string>>();
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

    const fill = parseFillAssignmentsFromAnswerData(parsedData);
    if (fill && Object.keys(fill).length > 0) {
      const q = questions.find((x) => x.id === row.question_id);
      if (q?.type === "fill_in_the_blanks") {
        const prev = reviewFillByQuestionId.get(row.question_id) ?? {};
        reviewFillByQuestionId.set(row.question_id, { ...prev, ...fill });
      }
    }
  }

  return {
    reviewRowsByQuestionId,
    reviewCorrectIdsByQuestionId,
    reviewFillByQuestionId,
    reviewAnswersByQuestionId,
  };
}
