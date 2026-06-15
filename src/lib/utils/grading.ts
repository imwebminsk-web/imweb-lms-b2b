import {
  isGapFillPartialScoringQuestionType,
  isPartialPairScoringType,
  sumQuestionsMaxPoints,
} from "@/lib/utils/scoring-utils";
import type { Json } from "@/types/database.types";

export type GradingColor = "green" | "yellow" | "red";

export type GradingVisuals = {
  isForKids: boolean;
  /** Нормализованный процент 0–100. */
  scorePercent: number;
  /** Шкала 0–10 для взрослых тестов и журнала. */
  grade10: number | null;
  emoji: string | null;
  color: GradingColor | null;
  /** Показывать числовой балл / процент в UI. */
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

export function percentToGrade10(percent: number): number {
  return Math.max(0, Math.min(10, Math.round(percent / 10)));
}

/** Обратное преобразование для ручной правки оценки преподавателем (0–10 → 0–100). */
export function grade10ToPercentScore(grade10: number): number {
  return Math.max(0, Math.min(100, Math.round(grade10 * 10)));
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
  const grade10 = percentToGrade10(scorePercent);

  if (!isForKids) {
    return {
      isForKids: false,
      scorePercent,
      grade10,
      emoji: null,
      color: null,
      showNumeric: true,
    };
  }

  let emoji: string;
  let color: GradingColor;

  if (scorePercent >= 100) {
    emoji = "😁";
    color = "green";
  } else if (scorePercent >= 75) {
    emoji = "🙂";
    color = "yellow";
  } else {
    emoji = "😢";
    color = "red";
  }

  return {
    isForKids: true,
    scorePercent,
    grade10,
    emoji,
    color,
    showNumeric: false,
  };
}

export const GRADING_COLOR_BG_CLASSES: Record<GradingColor, string> = {
  green:
    "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100 border-green-300 dark:border-green-800",
  yellow:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100 border-yellow-300 dark:border-yellow-800",
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100 border-red-300 dark:border-red-800",
};
