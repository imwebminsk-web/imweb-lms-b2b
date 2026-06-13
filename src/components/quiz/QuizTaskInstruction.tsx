"use client";

import { RichTextHtml } from "@/components/quiz/RichTextHtml";
import { cn } from "@/lib/utils";
import type { TaskPresentation } from "@/lib/utils/task-content";

export type QuizTaskInstructionProps = {
  task: TaskPresentation;
  /** Показывается, если в content нет HTML-инструкции (например, fill без text). */
  fallbackTitle?: string | null;
  /** Крупный заголовок (по умолчанию) или компактный блок. */
  variant?: "heading" | "section";
  className?: string;
};

export function QuizTaskInstruction({
  task,
  fallbackTitle,
  variant = "heading",
  className,
}: QuizTaskInstructionProps) {
  const instructionHtml =
    task.instructionHtml.trim() ||
    (fallbackTitle?.trim() ? fallbackTitle.trim() : "");
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
        <RichTextHtml html={instructionHtml} className={instructionClass} />
      ) : null}

      {hasExample ? (
        <p className="text-muted-foreground text-sm italic">
          Пример: {task.exampleText}
        </p>
      ) : null}
    </div>
  );
}
