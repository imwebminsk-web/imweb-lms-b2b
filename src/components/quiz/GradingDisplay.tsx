import {
  getGradingVisuals,
  GRADING_COLOR_RING_CLASSES,
  type GradingColor,
  type GradingVisuals,
} from "@/lib/utils/grading";
import { cn } from "@/lib/utils";

const KIDS_EMOJI_ANIMATION_BY_COLOR: Record<GradingColor, string> = {
  green: "motion-safe:animate-bounce",
  blue: "motion-safe:animate-zoom-pulse",
  yellow: "motion-safe:animate-slow-spin",
  orange: "motion-safe:animate-strong-sway",
  red: "motion-safe:animate-heavy-shake",
};

type GradingDisplayProps = {
  score: number | null | undefined;
  isForKids: boolean;
  totalPossiblePoints?: number;
  /** Компактный вид для ячеек журнала. */
  compact?: boolean;
  /** Анимация эмодзи (только post-test в QuizPlayer). */
  animate?: boolean;
  className?: string;
};

export function resolveGradingVisuals(
  score: number | null | undefined,
  isForKids: boolean,
  totalPossiblePoints = 100,
): GradingVisuals {
  return getGradingVisuals(score, isForKids, totalPossiblePoints);
}

export function GradingDisplay({
  score,
  isForKids,
  totalPossiblePoints = 100,
  compact = false,
  animate = false,
  className,
}: GradingDisplayProps) {
  const visuals = resolveGradingVisuals(score, isForKids, totalPossiblePoints);

  if (visuals.isForKids && visuals.emoji && visuals.color) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full leading-none",
          compact ? "size-12 text-3xl" : "size-14 text-4xl",
          GRADING_COLOR_RING_CLASSES[visuals.color],
          animate && KIDS_EMOJI_ANIMATION_BY_COLOR[visuals.color],
          className,
        )}
        aria-label={`Результат: ${visuals.scorePercent} процентов`}
        title={`${visuals.scorePercent}%`}
      >
        {visuals.emoji}
      </span>
    );
  }

  if (visuals.showNumeric) {
    return (
      <span
        className={cn(
          "font-medium tabular-nums",
          compact ? "text-sm" : "text-lg",
          className,
        )}
      >
        {visuals.scorePercent}
      </span>
    );
  }

  return <span className={cn("text-muted-foreground", className)}>—</span>;
}
