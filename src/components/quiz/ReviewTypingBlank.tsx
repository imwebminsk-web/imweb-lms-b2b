"use client";

import { isFillBlankTypingAnswerCorrect } from "@/lib/fill-blanks-scoring";
import { cn } from "@/lib/utils";

export type ReviewTypingBlankProps = {
  blankId: string;
  typed: string;
  correctText: string;
};

export function ReviewTypingBlank({
  blankId,
  typed,
  correctText,
}: ReviewTypingBlankProps) {
  const ok = isFillBlankTypingAnswerCorrect(typed, correctText);

  return (
    <span
      className="mx-0.5 inline-flex flex-col items-start align-middle"
      data-blank-review={blankId}
    >
      <span
        className={cn(
          "inline-flex min-h-8 min-w-[4.5rem] items-center justify-center rounded border px-2 py-1 text-sm font-medium",
          ok
            ? "border-green-500 bg-green-50 text-slate-900"
            : "border-red-500 bg-red-50 text-red-900 dark:text-red-100",
        )}
      >
        {typed.trim() || "—"}
      </span>
      {!ok ? (
        <span className="mt-1 block max-w-[200px] text-xs font-medium text-green-600 dark:text-green-400">
          Правильный ответ: {correctText}
        </span>
      ) : null}
    </span>
  );
}
