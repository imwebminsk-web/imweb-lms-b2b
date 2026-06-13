"use client";

import { Input } from "@/components/ui/input";
import {
  correctTextForBlank,
  isFillBlanksTypingFullyCorrect,
} from "@/lib/fill-blanks-scoring";
import { cn } from "@/lib/utils";
import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";

export type FillBlanksTypingQuestionProps = {
  content: FillInTheBlanksContent;
  value?: Record<string, string>;
  onChange?: (fillTyping: Record<string, string>) => void;
  isReviewMode?: boolean;
};

function ReviewTypingBlank({
  blankId,
  typed,
  correctText,
}: {
  blankId: string;
  typed: string;
  correctText: string;
}) {
  const ok = typed === correctText;
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle">
      <span
        className={cn(
          "inline-flex min-h-8 min-w-[4.5rem] items-center justify-center rounded border px-2 py-1 text-sm font-medium",
          ok
            ? "border-green-500 bg-green-50 text-slate-900"
            : "border-red-500 bg-red-50 text-slate-900",
        )}
      >
        {typed || "—"}
      </span>
      {!ok ? (
        <span className="mt-0.5 max-w-[140px] text-center text-xs leading-tight text-green-700">
          верно: «{correctText}»
        </span>
      ) : null}
    </span>
  );
}

export function FillBlanksTypingQuestion({
  content,
  value: valueProp,
  onChange,
  isReviewMode = false,
}: FillBlanksTypingQuestionProps) {
  const assignments = valueProp ?? {};

  function updateBlank(blankId: string, nextValue: string) {
    onChange?.({ ...assignments, [blankId]: nextValue });
  }

  if (isReviewMode) {
    return (
      <p className="text-foreground text-sm leading-relaxed">
        {content.segments.map((seg, i) => {
          if (seg.type === "text") {
            return <span key={i}>{seg.value}</span>;
          }
          const correctText = correctTextForBlank(content, seg.id) ?? "";
          return (
            <ReviewTypingBlank
              key={seg.id}
              blankId={seg.id}
              typed={assignments[seg.id] ?? ""}
              correctText={correctText}
            />
          );
        })}
      </p>
    );
  }

  return (
    <p className="text-foreground text-sm leading-loose">
      {content.segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.value}</span>;
        }
        const correctLen =
          correctTextForBlank(content, seg.id)?.length ?? 8;
        const widthCh = Math.min(Math.max(correctLen + 2, 6), 24);
        return (
          <Input
            key={seg.id}
            type="text"
            value={assignments[seg.id] ?? ""}
            onChange={(e) => updateBlank(seg.id, e.target.value)}
            aria-label={`Пропуск ${seg.id}`}
            className="mx-0.5 inline-block h-8 align-middle px-2 py-1 text-sm"
            style={{ width: `${widthCh}ch` }}
            autoComplete="off"
            spellCheck={false}
          />
        );
      })}
    </p>
  );
}

export { isFillBlanksTypingFullyCorrect };
