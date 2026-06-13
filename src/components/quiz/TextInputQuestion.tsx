"use client";

import { cn } from "@/lib/utils";
import type { TextInputContent } from "@/lib/validations/fill-in-the-blanks-schema";

export type TextInputQuestionProps = {
  content: TextInputContent;
  value?: Record<string, string>;
  onChange?: (fillTyping: Record<string, string>) => void;
  isReviewMode?: boolean;
};

function ExpandingBlankInput({
  blankId,
  value,
  onChange,
  disabled,
}: {
  blankId: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const widthCh = Math.max(10, value.length + 2);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={`Поле ответа ${blankId}`}
      autoComplete="off"
      className={cn(
        "border-input bg-background text-foreground mx-0.5 inline-block h-9 align-middle rounded-md border px-2 py-1 text-sm shadow-xs transition-[width] duration-150 ease-out",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
      )}
      style={{ width: `max(10ch, ${widthCh}ch)` }}
    />
  );
}

export function TextInputQuestion({
  content,
  value: valueProp,
  onChange,
  isReviewMode = false,
}: TextInputQuestionProps) {
  const assignments = valueProp ?? {};

  function updateBlank(blankId: string, nextValue: string) {
    onChange?.({ ...assignments, [blankId]: nextValue });
  }

  return (
    <p className="text-foreground text-sm leading-loose">
      {content.segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.value}</span>;
        }

        const typed = assignments[seg.id] ?? "";

        if (isReviewMode) {
          return (
            <span
              key={seg.id}
              className="border-border bg-muted/60 text-foreground mx-0.5 inline-block min-w-[10ch] rounded-md border px-2 py-1 align-middle text-sm"
            >
              {typed || "—"}
            </span>
          );
        }

        return (
          <ExpandingBlankInput
            key={seg.id}
            blankId={seg.id}
            value={typed}
            onChange={(next) => updateBlank(seg.id, next)}
          />
        );
      })}
    </p>
  );
}
