import {
  getGradingVisuals,
  type GradingVisuals,
} from "@/lib/utils/grading";
import { cn } from "@/lib/utils";

type GradingDisplayProps = {
  score: number | null | undefined;
  totalPossiblePoints?: number;
  /** Компактный вид для ячеек журнала. */
  compact?: boolean;
  className?: string;
};

export function resolveGradingVisuals(
  score: number | null | undefined,
  totalPossiblePoints = 100,
): GradingVisuals {
  return getGradingVisuals(score, totalPossiblePoints);
}

export function GradingDisplay({
  score,
  totalPossiblePoints = 100,
  compact = false,
  className,
}: GradingDisplayProps) {
  const visuals = resolveGradingVisuals(score, totalPossiblePoints);

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
