"use client";

import { memo } from "react";

import { TaskMediaRenderer } from "@/components/quiz/TaskMediaRenderer";
import { cn } from "@/lib/utils";
import { normalizeRichTextHtml } from "@/lib/utils/rich-text-content";
import type { TaskPresentation } from "@/lib/utils/task-content";

export type QuizTaskInstructionProps = {
  task: TaskPresentation;
  /** Показывается, если в content нет HTML-инструкции (например, fill без text). */
  fallbackTitle?: string | null;
  /** Крупный заголовок (по умолчанию) или компактный блок. */
  variant?: "heading" | "section";
  className?: string;
  isReviewMode?: boolean;
};

export const QuizTaskInstruction = memo(function QuizTaskInstruction({
  task,
  fallbackTitle,
  variant = "heading",
  className,
  isReviewMode = false,
}: QuizTaskInstructionProps) {
  // Пустой TipTap (`<p></p>`) не считается формулировкой — иначе fallback
  // («Развёрнутый ответ») подменяет реальный content.text.
  const savedInstruction = normalizeRichTextHtml(task.instructionHtml);
  const instructionHtml =
    savedInstruction || (fallbackTitle?.trim() ? fallbackTitle.trim() : "");
  const hasInstruction = Boolean(instructionHtml);
  const hasExample = Boolean(task.exampleText);

  if (!hasInstruction && !hasExample) {
    return null;
  }

  const instructionClass =
    variant === "heading"
      ? "text-foreground text-2xl leading-snug font-semibold tracking-tight md:text-3xl [&_strong]:font-semibold"
      : "text-foreground text-lg leading-snug font-medium md:text-xl [&_strong]:font-semibold";

  return (
    <div className={cn("space-y-3", className)}>
      {hasInstruction ? (
        <TaskMediaRenderer
          html={instructionHtml}
          className={instructionClass}
          mediaPlayLimit={task.mediaPlayLimit}
          isReviewMode={isReviewMode}
        />
      ) : null}

      {hasExample ? (
        <p className="text-muted-foreground text-sm italic">
          Пример: {task.exampleText}
        </p>
      ) : null}
    </div>
  );
});
