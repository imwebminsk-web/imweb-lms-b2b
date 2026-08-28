"use client";

import {
  getGradeColor,
  PROGRESS_STATUS_VISUAL,
  resolveGradebookCellVisual,
} from "@/components/dashboard/gradebook/progress-status-visuals";
import { cn } from "@/lib/utils";

type JournalPointsDisplayProps = {
  points: number | null;
  /** Если баллов нет — показываем иконку статуса, как в MatrixCell. */
  status?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * Баллы или иконка статуса: одна и та же логика, что в ячейке матрицы журнала.
 */
export function JournalPointsDisplay({
  points,
  status,
  className,
}: JournalPointsDisplayProps) {
  const visual = resolveGradebookCellVisual(status, points);

  if (visual.kind === "points") {
    return (
      <span
        className={cn(
          "font-medium tabular-nums",
          getGradeColor(visual.points),
          className,
        )}
      >
        {visual.points}%
      </span>
    );
  }

  if (visual.kind === "status") {
    const { Icon, className: iconClass, label } =
      PROGRESS_STATUS_VISUAL[visual.key];
    return (
      <Icon
        className={cn("size-4", iconClass, className)}
        aria-label={label}
      />
    );
  }

  return (
    <span className={cn("text-muted-foreground tabular-nums", className)}>
      —
    </span>
  );
}
