"use client";

import { Textarea } from "@/components/ui/textarea";
import {
  normalizeItemTypingForBlanks,
  resolveReviewDisplayTypingValue,
} from "@/lib/grouped-fill-blanks-utils";
import { cn } from "@/lib/utils";
import type { TextInputContent } from "@/lib/validations/fill-in-the-blanks-schema";

export type TextInputQuestionProps = {
  content: TextInputContent;
  value?: Record<string, string> | string;
  /** Сырой answer_data из БД — для brute-force в review mode. */
  reviewRawAnswer?: unknown;
  onChange?: (fillTyping: Record<string, string>) => void;
  isReviewMode?: boolean;
};

function resolveAssignments(
  content: TextInputContent,
  valueProp: Record<string, string> | string | undefined,
): Record<string, string> {
  const blankIds = content.segments
    .filter((seg) => seg.type === "blank")
    .map((seg) => seg.id);

  if (typeof valueProp === "string") {
    return normalizeItemTypingForBlanks(valueProp, blankIds);
  }

  return normalizeItemTypingForBlanks(valueProp ?? {}, blankIds);
}

function resolveTextareaValue(params: {
  isReviewMode: boolean;
  reviewRawAnswer: unknown;
  valueProp: Record<string, string> | string | undefined;
  assignments: Record<string, string>;
  blankId: string;
  blankIds: string[];
}): string {
  if (params.isReviewMode) {
    return resolveReviewDisplayTypingValue({
      rawValue: params.reviewRawAnswer ?? params.valueProp,
      assignments: params.assignments,
      blankId: params.blankId,
      blankIds: params.blankIds,
    });
  }

  return params.assignments[params.blankId] ?? "";
}

export function TextInputQuestion({
  content,
  value: valueProp,
  reviewRawAnswer,
  onChange,
  isReviewMode = false,
}: TextInputQuestionProps) {
  const assignments = resolveAssignments(content, valueProp);

  const blankIds = content.segments
    .filter((seg) => seg.type === "blank")
    .map((seg) => seg.id);

  function updateBlank(blankId: string, nextValue: string) {
    onChange?.({ ...assignments, [blankId]: nextValue });
  }

  return (
    <div className="text-foreground space-y-3 text-sm">
      {content.segments.map((seg, i) => {
        if (seg.type === "text") {
          if (!seg.value.trim()) return null;
          return (
            <div key={i} className="leading-relaxed whitespace-pre-wrap">
              {seg.value}
            </div>
          );
        }

        const finalValue = resolveTextareaValue({
          isReviewMode,
          reviewRawAnswer,
          valueProp,
          assignments,
          blankId: seg.id,
          blankIds,
        });

        return (
          <Textarea
            key={seg.id}
            value={finalValue}
            readOnly={isReviewMode}
            onChange={(e) => updateBlank(seg.id, e.target.value)}
            aria-label={`Поле ответа ${seg.id}`}
            placeholder={isReviewMode ? undefined : "Введите развёрнутый ответ…"}
            className={cn(
              "min-h-[120px] w-full resize-y",
              isReviewMode && "bg-muted/60 cursor-default",
            )}
          />
        );
      })}
    </div>
  );
}
