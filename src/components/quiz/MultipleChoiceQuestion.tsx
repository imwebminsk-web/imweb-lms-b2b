"use client";

import type { SafeTestOption } from "@/app/actions/test-actions";
import type { Json } from "@/types/database.types";

function textFromContent(content: Json): string {
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    "text" in content &&
    typeof (content as { text: unknown }).text === "string"
  ) {
    return (content as { text: string }).text;
  }
  return typeof content === "string" ? content : String(content ?? "");
}

export type MultipleChoiceQuestionProps = {
  options: SafeTestOption[];
  selectedIds: string[];
  onToggle: (optionId: string) => void;
};

export function MultipleChoiceQuestion({
  options,
  selectedIds,
  onToggle,
}: MultipleChoiceQuestionProps) {
  const set = new Set(selectedIds);

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Варианты ответа">
      {options.map((opt) => {
        const checked = set.has(opt.id);
        return (
          <label
            key={opt.id}
            className={
              "border-input hover:bg-muted/60 focus-within:ring-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 md:min-h-12 " +
              (checked
                ? "border-primary bg-primary/10 ring-primary/20 ring-2"
                : "bg-card")
            }
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(opt.id)}
              className="border-input text-primary mt-1 size-4 shrink-0 rounded"
            />
            <span className="text-left text-base leading-snug md:text-lg">
              {textFromContent(opt.content)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
