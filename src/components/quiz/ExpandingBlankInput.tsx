"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type FormEvent,
} from "react";

import { cn } from "@/lib/utils";

const DEFAULT_MIN_WIDTH_CH = 20;

export type ExpandingBlankInputProps = {
  blankId: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  spellCheck?: boolean;
  minWidthCh?: number;
};

function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Inline auto-growing textarea (hidden span + CSS grid for width).
 * Supports multiline dictation via Enter / Shift+Enter.
 */
export function ExpandingBlankInput({
  blankId,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  ariaLabel,
  className,
  spellCheck,
  minWidthCh = DEFAULT_MIN_WIDTH_CH,
}: ExpandingBlankInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorText =
    value.length > 0 ? value : (placeholder?.trim() ? placeholder : "\u00a0");

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) resizeTextarea(el);
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, mirrorText, syncHeight]);

  function handleInput(event: FormEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    resizeTextarea(target);
    onChange(target.value);
  }

  return (
    <span
      className="mx-0.5 my-0.5 inline-grid max-w-full items-center align-middle"
      style={{ gridTemplateColumns: `minmax(${minWidthCh}ch, auto)` }}
    >
      <span
        className="invisible col-start-1 row-start-1 whitespace-pre-wrap border border-transparent px-2 py-1 text-center text-sm font-normal leading-normal"
        aria-hidden
      >
        {mirrorText}
      </span>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onInput={handleInput}
        onChange={handleInput}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-label={ariaLabel ?? `Поле ответа ${blankId}`}
        autoComplete="off"
        spellCheck={spellCheck}
        className={cn(
          "border-input bg-background text-foreground col-start-1 row-start-1 min-h-9 w-full min-w-0 max-w-full resize-none overflow-hidden rounded-md border px-2 py-1 text-center text-sm leading-normal whitespace-pre-wrap shadow-xs",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          readOnly && "bg-muted/60 min-h-[120px] cursor-default",
          className,
        )}
      />
    </span>
  );
}
