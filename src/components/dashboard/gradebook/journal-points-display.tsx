"use client";

import { GradingDisplay } from "@/components/quiz/GradingDisplay";
import { cn } from "@/lib/utils";

type JournalPointsDisplayProps = {
  points: number | null;
  isForKids: boolean;
  className?: string;
  compact?: boolean;
};

/**
 * Баллы журнала (0–100) или смайлик в детском режиме.
 * В kids mode числовой балл не показывается.
 */
export function JournalPointsDisplay({
  points,
  isForKids,
  className,
  compact = false,
}: JournalPointsDisplayProps) {
  if (points == null) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  if (isForKids) {
    return (
      <GradingDisplay
        score={points}
        isForKids
        totalPossiblePoints={100}
        compact={compact}
        className={className}
      />
    );
  }

  const pass = points >= 50;

  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        pass
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {points}
    </span>
  );
}
