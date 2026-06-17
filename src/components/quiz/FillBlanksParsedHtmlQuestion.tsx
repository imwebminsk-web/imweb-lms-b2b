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
import { useId, useMemo, useState } from "react";

import { ExpandingBlankInput } from "@/components/quiz/ExpandingBlankInput";
import { NativeMediaReviewPlaceholder } from "@/components/quiz/NativeMediaReviewPlaceholder";
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
import { transformMediaUrlsInHtml } from "@/lib/media-utils";
import {
  QUIZ_PROSE_BASE,
  QUIZ_PROSE_EMBEDDED_IMG,
  normalizeEmbeddedImagesInHtml,
} from "@/lib/quiz-rich-text-styles";
import { cn } from "@/lib/utils";
import {
  normalizeItemTypingForBlanks,
  resolveBlankIdsForGroupedFillBlanksItem,
  resolveReviewDisplayTypingValue,
  resolveTypingValueForBlank,
  type GroupedFillBlanksMode,
} from "@/lib/grouped-fill-blanks-utils";
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

export type FillBlanksParsedHtmlQuestionProps = {
  parsedHtml: string;
  mode: GroupedFillBlanksMode;
  segments: FillInTheBlanksSegment[];
  wordBank: FillInTheBlanksWord[];
  correctMapping: Record<string, string>;
  value?: Record<string, string> | string;
  /** Сырой answer_data из БД — для brute-force в review mode. */
  reviewRawAnswer?: unknown;
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
  reviewRawAnswer,
  onChange,
  isReviewMode = false,
}: FillBlanksParsedHtmlQuestionProps) {
  const dndId = useId();
  const [internal, setInternal] = useState<Record<string, string>>({});

  const blankIds = useMemo(
    () =>
      resolveBlankIdsForGroupedFillBlanksItem({
        segments,
        parsedHtml,
        correctMapping,
      }),
    [segments, parsedHtml, correctMapping],
  );

  const assignments = useMemo(() => {
    if (valueProp == null) return internal;
    if (typeof valueProp === "string") {
      return normalizeItemTypingForBlanks(valueProp, blankIds);
    }
    return valueProp;
  }, [valueProp, internal, blankIds]);

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
    if (valueProp === undefined) setInternal(next);
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

  function typedForBlank(blankId: string): string {
    if (isReviewMode) {
      return resolveReviewDisplayTypingValue({
        rawValue: reviewRawAnswer ?? valueProp,
        assignments,
        blankId,
        blankIds,
      });
    }
    return resolveTypingValueForBlank(assignments, blankId, blankIds);
  }

  const embedReadyHtml = useMemo(
    () =>
      normalizeEmbeddedImagesInHtml(transformMediaUrlsInHtml(parsedHtml)),
    [parsedHtml],
  );

  function renderBlank(blankId: string) {
    if (mode === "dnd") {
      if (isReviewMode) {
        const userWid = assignments[blankId];
        const correctWid = correctMapping[blankId];
        if (!correctWid) {
          const userWord = userWid ? wordById.get(userWid) : undefined;
          return (
            <span
              key={blankId}
              className="border-border bg-muted/60 text-foreground mx-0.5 inline-flex min-h-8 min-w-[4.5rem] items-center justify-center rounded-md border px-2 py-1 align-middle text-sm"
            >
              {userWord?.text ?? (userWid?.trim() ? userWid : "—")}
            </span>
          );
        }
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
      const typed = typedForBlank(blankId);
      if (isReviewMode) {
        return (
          <ExpandingBlankInput
            key={blankId}
            blankId={blankId}
            value={typed}
            onChange={() => {}}
            readOnly
          />
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
          typed={typedForBlank(blankId)}
          correctText={correctText}
        />
      );
    }
    return (
      <ExpandingBlankInput
        key={blankId}
        blankId={blankId}
        value={typedForBlank(blankId)}
        onChange={(next) => updateBlank(blankId, next)}
        ariaLabel={`Пропуск ${blankId}`}
        spellCheck={false}
      />
    );
  }

  const parsedBody = (
    <div
      className={cn(
        QUIZ_PROSE_BASE,
        QUIZ_PROSE_EMBEDDED_IMG,
        "text-foreground text-sm md:text-base",
        isReviewMode ? "leading-relaxed" : "leading-loose",
        !isReviewMode &&
          "[&_audio]:mx-auto [&_audio]:my-2 [&_audio]:block [&_audio]:h-10 [&_audio]:w-full [&_audio]:max-w-lg",
        !isReviewMode &&
          "[&_video]:mx-auto [&_video]:my-4 [&_video]:aspect-video [&_video]:w-full [&_video]:max-w-3xl [&_video]:rounded-lg",
        "[&_.blank-placeholder]:border-primary/40 [&_.blank-placeholder]:bg-primary/10 [&_.blank-placeholder]:mx-0.5 [&_.blank-placeholder]:my-1 [&_.blank-placeholder]:inline-block [&_.blank-placeholder]:min-h-[1.5rem] [&_.blank-placeholder]:min-w-[4rem] [&_.blank-placeholder]:rounded [&_.blank-placeholder]:border [&_.blank-placeholder]:align-middle",
      )}
    >
      {parse(embedReadyHtml, {
        replace(domNode) {
          if (!isDomElement(domNode)) return undefined;
          const tag = domNode.name?.toLowerCase();
          if (
            isReviewMode &&
            (tag === "video" || tag === "audio")
          ) {
            const src = domNode.attribs.src ?? tag;
            return <NativeMediaReviewPlaceholder key={`review-media-${src}`} />;
          }
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
        id={dndId}
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
