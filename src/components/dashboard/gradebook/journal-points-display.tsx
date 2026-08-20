"use client";

import { cn } from "@/lib/utils";

type JournalPointsDisplayProps = {
  points: number | null;
  className?: string;
  compact?: boolean;
};

/**
 * Баллы журнала (0–100): зелёный при проходе (≥50), красный ниже.
 */
export function JournalPointsDisplay({
  points,
  className,
}: JournalPointsDisplayProps) {
  if (points == null) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
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
