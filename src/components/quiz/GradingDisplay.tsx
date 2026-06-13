import {
  getGradingVisuals,
  GRADING_COLOR_BG_CLASSES,
  type GradingVisuals,
} from "@/lib/utils/grading";
import { cn } from "@/lib/utils";

type GradingDisplayProps = {
  score: number | null | undefined;
  isForKids: boolean;
  totalPossiblePoints?: number;
  /** Компактный вид для ячеек журнала. */
  compact?: boolean;
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
  className,
}: GradingDisplayProps) {
  const visuals = resolveGradingVisuals(score, isForKids, totalPossiblePoints);

  if (visuals.isForKids && visuals.emoji && visuals.color) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border font-medium",
          compact ? "size-8 text-xl" : "size-20 text-5xl",
          GRADING_COLOR_BG_CLASSES[visuals.color],
          className,
        )}
        aria-label={`Результат: ${visuals.scorePercent} процентов`}
        title={`${visuals.scorePercent}%`}
      >
        {visuals.emoji}
      </span>
    );
  }

  if (visuals.grade10 != null) {
    return (
      <span
        className={cn(
          "font-medium tabular-nums",
          compact ? "text-sm" : "text-lg",
          className,
        )}
      >
        {visuals.grade10}
      </span>
    );
  }

  return <span className={cn("text-muted-foreground", className)}>—</span>;
}
