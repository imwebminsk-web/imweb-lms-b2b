import {
  isGapFillPartialScoringQuestionType,
  isPartialPairScoringType,
  sumQuestionsMaxPoints,
} from "@/lib/utils/scoring-utils";
import type { Json } from "@/types/database.types";

export type GradingColor = "green" | "blue" | "yellow" | "orange" | "red";

export type GradingVisuals = {
  isForKids: boolean;
  /** Нормализованный балл 0–100. */
  scorePercent: number;
  emoji: string | null;
  color: GradingColor | null;
  /** Показывать числовой балл в UI. */
  showNumeric: boolean;
};

/**
 * Приводит `student_attempts.score` к проценту 0–100.
 * Новые попытки хранят процент; legacy — сумму верных «единиц» / вопросов.
 */
export function normalizeAttemptScoreToPercent(
  score: number | null | undefined,
  totalPossiblePoints: number,
): number {
  if (score == null || totalPossiblePoints <= 0) return 0;
  const raw = Math.round(score);

  if (raw > 100) {
    return Math.max(
      0,
      Math.min(100, Math.round((raw / totalPossiblePoints) * 100)),
    );
  }

  if (raw <= totalPossiblePoints) {
    return Math.max(
      0,
      Math.min(100, Math.round((raw / totalPossiblePoints) * 100)),
    );
  }

  return Math.max(0, Math.min(100, raw));
}

/** Итоговый балл попытки в БД: всегда целое 0–100 (процент). */
export function clampScorePercent(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(Number(score))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(score))));
}

export function resolveQuestionPoints(points: number | null | undefined): number {
  return points != null && points > 0 ? points : 1;
}

export function sumQuestionPoints(
  questions: {
    id?: string;
    type?: string | null;
    points?: number | null;
    content?: Json | null;
    options?: { id: string; content: Json | null }[];
  }[],
  flatAllOptions?: {
    id: string;
    question_id: string;
    content: Json | null;
  }[],
): number {
  const hasPartialTypes = questions.some(
    (q) =>
      isPartialPairScoringType(q.type ?? null) ||
      isGapFillPartialScoringQuestionType(q.type ?? null),
  );
  const allOptions =
    flatAllOptions ??
    questions.flatMap((q) =>
      q.id
        ? (q.options ?? []).map((option) => ({
            id: option.id,
            question_id: q.id!,
            content: option.content,
          }))
        : [],
    );

  if (hasPartialTypes && questions.every((q) => typeof q.id === "string")) {
    return sumQuestionsMaxPoints(
      questions as {
        id: string;
        type: string | null;
        points?: number | null;
        content?: Json | null;
      }[],
      allOptions,
    );
  }

  return questions.reduce(
    (sum, q) => sum + resolveQuestionPoints(q.points),
    0,
  );
}

export function getGradingVisuals(
  score: number | null | undefined,
  isForKids: boolean,
  totalPossiblePoints = 100,
): GradingVisuals {
  const scorePercent = normalizeAttemptScoreToPercent(
    score,
    totalPossiblePoints,
  );

  if (!isForKids) {
    return {
      isForKids: false,
      scorePercent,
      emoji: null,
      color: null,
      showNumeric: true,
    };
  }

  let emoji: string;
  let color: GradingColor;

  if (scorePercent >= 81) {
    emoji = "😁";
    color = "green";
  } else if (scorePercent >= 65) {
    emoji = "🙂";
    color = "blue";
  } else if (scorePercent >= 51) {
    emoji = "😐";
    color = "yellow";
  } else if (scorePercent >= 26) {
    emoji = "🙁";
    color = "orange";
  } else {
    emoji = "😢";
    color = "red";
  }

  return {
    isForKids: true,
    scorePercent,
    emoji,
    color,
    showNumeric: false,
  };
}

export const GRADING_COLOR_RING_CLASSES: Record<GradingColor, string> = {
  green: "border-2 border-green-500/50 bg-green-500/10",
  blue: "border-2 border-blue-500/50 bg-blue-500/10",
  yellow: "border-2 border-yellow-500/50 bg-yellow-500/10",
  orange: "border-2 border-orange-500/50 bg-orange-500/10",
  red: "border-2 border-red-500/50 bg-red-500/10",
};
