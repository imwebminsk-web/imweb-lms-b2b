"use client";

import parse, { type DOMNode, type Element } from "html-react-parser";
import {
  DndContext,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  BlankSlotWithDrop,
  DraggableWordBankItem,
  ReviewBlankSlot,
  WordBankDropZone,
  FITB_BANK_DROP_ID,
  FITB_BLANK_PREFIX,
  FITB_WORD_PREFIX,
} from "@/components/quiz/FillInTheBlanksQuestion";
import { correctTextForBlank } from "@/lib/fill-blanks-scoring";
import { cn } from "@/lib/utils";
import type { GroupedFillBlanksMode } from "@/lib/grouped-fill-blanks-utils";
import type {
  FillInTheBlanksSegment,
  FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";

function isDomElement(node: DOMNode): node is Element {
  return node.type === "tag" && "attribs" in node;
}

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

export type FillBlanksParsedHtmlQuestionProps = {
  parsedHtml: string;
  mode: GroupedFillBlanksMode;
  segments: FillInTheBlanksSegment[];
  wordBank: FillInTheBlanksWord[];
  correctMapping: Record<string, string>;
  value?: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
  isReviewMode?: boolean;
};

export function FillBlanksParsedHtmlQuestion({
  parsedHtml,
  mode,
  segments,
  wordBank,
  correctMapping,
  value: valueProp,
  onChange,
  isReviewMode = false,
}: FillBlanksParsedHtmlQuestionProps) {
  const [internal, setInternal] = useState<Record<string, string>>({});
  const controlled = valueProp !== undefined;
  const assignments = controlled ? valueProp : internal;

  const wordById = useMemo(() => {
    const m = new Map<string, FillInTheBlanksWord>();
    for (const w of wordBank) m.set(w.id, w);
    return m;
  }, [wordBank]);

  const assignedWordIds = useMemo(
    () => new Set(Object.values(assignments)),
    [assignments],
  );

  const poolWords = useMemo(
    () => wordBank.filter((w) => !assignedWordIds.has(w.id)),
    [wordBank, assignedWordIds],
  );

  function patchAssignments(next: Record<string, string>) {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  function removeWordFromAssignments(
    prev: Record<string, string>,
    wordId: string,
  ): Record<string, string> {
    const next = { ...prev };
    for (const k of Object.keys(next)) {
      if (next[k] === wordId) delete next[k];
    }
    return next;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const aid = String(active.id);
    if (!aid.startsWith(FITB_WORD_PREFIX)) return;
    const wordId = aid.slice(FITB_WORD_PREFIX.length);
    const overId = over ? String(over.id) : null;

    if (overId?.startsWith(FITB_BLANK_PREFIX)) {
      const blankId = overId.slice(FITB_BLANK_PREFIX.length);
      let next = removeWordFromAssignments(assignments, wordId);
      next = { ...next, [blankId]: wordId };
      patchAssignments(next);
      return;
    }

    if (overId === FITB_BANK_DROP_ID || overId === null) {
      patchAssignments(removeWordFromAssignments(assignments, wordId));
    }
  }

  function updateBlank(blankId: string, nextValue: string) {
    patchAssignments({ ...assignments, [blankId]: nextValue });
  }

  const contentForScoring = useMemo(
    () => ({ segments, wordBank, correctMapping }),
    [segments, wordBank, correctMapping],
  );

  function renderBlank(blankId: string) {
    if (mode === "dnd") {
      if (isReviewMode) {
        const userWid = assignments[blankId];
        const correctWid = correctMapping[blankId];
        if (!correctWid) return null;
        return (
          <ReviewBlankSlot
            key={blankId}
            blankId={blankId}
            userWordId={userWid}
            correctWordId={correctWid}
            wordById={wordById}
          />
        );
      }
      const wid = assignments[blankId];
      const assigned = wid ? wordById.get(wid) : undefined;
      return (
        <BlankSlotWithDrop
          key={blankId}
          blankId={blankId}
          assignedWord={assigned}
        />
      );
    }

    if (mode === "text_input") {
      const typed = assignments[blankId] ?? "";
      if (isReviewMode) {
        return (
          <span
            key={blankId}
            className="border-border bg-muted/60 text-foreground mx-0.5 inline-block min-w-[10ch] rounded-md border px-2 py-1 align-middle text-sm"
          >
            {typed || "—"}
          </span>
        );
      }
      return (
        <ExpandingBlankInput
          key={blankId}
          blankId={blankId}
          value={typed}
          onChange={(next) => updateBlank(blankId, next)}
        />
      );
    }

    const correctText = correctTextForBlank(contentForScoring, blankId) ?? "";
    if (isReviewMode) {
      return (
        <ReviewTypingBlank
          key={blankId}
          blankId={blankId}
          typed={assignments[blankId] ?? ""}
          correctText={correctText}
        />
      );
    }
    const correctLen = correctText.length || 8;
    const widthCh = Math.min(Math.max(correctLen + 2, 6), 24);
    return (
      <Input
        key={blankId}
        type="text"
        value={assignments[blankId] ?? ""}
        onChange={(e) => updateBlank(blankId, e.target.value)}
        aria-label={`Пропуск ${blankId}`}
        className="mx-0.5 inline-block h-8 align-middle px-2 py-1 text-sm"
        style={{ width: `${widthCh}ch` }}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }

  const parsedBody = (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground text-sm leading-relaxed md:text-base",
        "[&_p]:my-0 [&_p+p]:mt-2 [&_audio]:mx-auto [&_audio]:my-2 [&_audio]:block [&_audio]:h-10 [&_audio]:w-full [&_audio]:max-w-lg",
        "[&_video]:mx-auto [&_video]:my-4 [&_video]:aspect-video [&_video]:w-full [&_video]:max-w-3xl [&_video]:rounded-lg",
        "[&_.blank-placeholder]:border-primary/40 [&_.blank-placeholder]:bg-primary/10 [&_.blank-placeholder]:mx-0.5 [&_.blank-placeholder]:inline-block [&_.blank-placeholder]:min-h-[1.5rem] [&_.blank-placeholder]:min-w-[4rem] [&_.blank-placeholder]:rounded [&_.blank-placeholder]:border [&_.blank-placeholder]:align-middle",
      )}
    >
      {parse(parsedHtml, {
        replace(domNode) {
          if (!isDomElement(domNode)) return undefined;
          const blankId = domNode.attribs["data-blank-id"];
          if (blankId) {
            return renderBlank(blankId);
          }
          return undefined;
        },
      })}
    </div>
  );

  if (mode === "dnd" && !isReviewMode) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-6">
          {parsedBody}
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm font-medium">
              Банк слов
            </p>
            <WordBankDropZone>
              {poolWords.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  Все слова расставлены.
                </span>
              ) : (
                poolWords.map((w) => (
                  <DraggableWordBankItem key={w.id} word={w} />
                ))
              )}
            </WordBankDropZone>
          </div>
        </div>
      </DndContext>
    );
  }

  return parsedBody;
}
