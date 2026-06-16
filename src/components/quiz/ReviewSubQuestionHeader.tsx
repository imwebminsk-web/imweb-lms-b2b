"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReviewSubQuestionHeaderProps = {
  index: number;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  pendingReview?: boolean;
  className?: string;
};

export function ReviewSubQuestionHeader({
  index,
  earnedPoints,
  maxPoints,
  isCorrect,
  pendingReview = false,
  className,
}: ReviewSubQuestionHeaderProps) {
  const { t } = useLanguage();

  const isPartial =
    !pendingReview &&
    !isCorrect &&
    earnedPoints > 0 &&
    earnedPoints < maxPoints;

  const statusLabel = pendingReview
    ? t("quizResult.pendingReview")
    : isCorrect
      ? t("quizResult.correct")
      : isPartial
        ? t("quizResult.partial")
        : t("quizResult.incorrect");

  return (
    <p
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      <span>
        {t("quizResult.question")} {index + 1}
      </span>
      <Badge
        variant={
          pendingReview || isPartial
            ? "outline"
            : isCorrect
              ? "secondary"
              : "destructive"
        }
        className={cn(
          pendingReview &&
            "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          isPartial &&
            "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          isCorrect &&
            "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        )}
      >
        {statusLabel}
      </Badge>
      <span className="text-muted-foreground tabular-nums">
        ({earnedPoints} / {maxPoints} {t("quizResult.pointsUnit")})
      </span>
    </p>
  );
}
