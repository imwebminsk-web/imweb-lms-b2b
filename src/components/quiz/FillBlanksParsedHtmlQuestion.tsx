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
import { useId, useCallback, useContext, useMemo, useRef, useState, createContext } from "react";

import { ExpandingBlankInput } from "@/components/quiz/ExpandingBlankInput";
import { ReviewTypingBlank } from "@/components/quiz/ReviewTypingBlank";
import {
  BlankSlotWithDrop,
  DraggableWordBankItem,
  ReviewBlankSlot,
  WordBankDropZone,
  FITB_BANK_DROP_ID,
  FITB_BLANK_PREFIX,
  FITB_WORD_PREFIX,
} from "@/components/quiz/FillInTheBlanksQuestion";
import { NativeMediaReviewPlaceholder } from "@/components/quiz/NativeMediaReviewPlaceholder";
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
  type GroupedFillBlanksMode,
} from "@/lib/grouped-fill-blanks-utils";
import type {
  FillInTheBlanksSegment,
  FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";

function isDomElement(node: DOMNode): node is Element {
  return node.type === "tag" && "attribs" in node;
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

type FillBlanksParsedHtmlContextValue = {
  mode: GroupedFillBlanksMode;
  isReviewMode: boolean;
  assignments: Record<string, string>;
  updateBlank: (blankId: string, nextValue: string) => void;
  wordById: Map<string, FillInTheBlanksWord>;
  correctMapping: Record<string, string>;
  contentForScoring: {
    segments: FillInTheBlanksSegment[];
    wordBank: FillInTheBlanksWord[];
    correctMapping: Record<string, string>;
  };
  blankIds: string[];
  reviewRawAnswer?: unknown;
  valueProp?: Record<string, string> | string;
};

const FillBlanksParsedHtmlContext =
  createContext<FillBlanksParsedHtmlContextValue | null>(null);

function useFillBlanksParsedHtml(): FillBlanksParsedHtmlContextValue {
  const ctx = useContext(FillBlanksParsedHtmlContext);
  if (!ctx) {
    throw new Error(
      "ParsedHtmlBlankSlot must render inside FillBlanksParsedHtmlQuestion",
    );
  }
  return ctx;
}

function typedForBlankFromContext(
  ctx: FillBlanksParsedHtmlContextValue,
  blankId: string,
): string {
  if (ctx.isReviewMode) {
    return resolveReviewDisplayTypingValue({
      rawValue: ctx.reviewRawAnswer ?? ctx.valueProp,
      assignments: ctx.assignments,
      blankId,
      blankIds: ctx.blankIds,
    });
  }
  return ctx.assignments[blankId] ?? "";
}

/** Стабильный слот пропуска — читает ответ из контекста, не перезапуская parse(). */
function ParsedHtmlBlankSlot({ blankId }: { blankId: string }) {
  const ctx = useFillBlanksParsedHtml();
  const { mode, isReviewMode, assignments, updateBlank, wordById, correctMapping } =
    ctx;

  if (mode === "dnd") {
    if (isReviewMode) {
      const userWid = assignments[blankId];
      const correctWid = correctMapping[blankId];
      if (!correctWid) {
        const userWord = userWid ? wordById.get(userWid) : undefined;
        return (
          <span
            className="border-border bg-muted/60 text-foreground mx-0.5 inline-flex min-h-8 min-w-[4.5rem] items-center justify-center rounded-md border px-2 py-1 align-middle text-sm"
          >
            {userWord?.text ?? (userWid?.trim() ? userWid : "—")}
          </span>
        );
      }
      return (
        <ReviewBlankSlot
          blankId={blankId}
          userWordId={userWid}
          correctWordId={correctWid}
          wordById={wordById}
        />
      );
    }
    const wid = assignments[blankId];
    const assigned = wid ? wordById.get(wid) : undefined;
    return <BlankSlotWithDrop blankId={blankId} assignedWord={assigned} />;
  }

  if (mode === "text_input") {
    const typed = typedForBlankFromContext(ctx, blankId);
    if (isReviewMode) {
      return (
        <ExpandingBlankInput
          blankId={blankId}
          value={typed}
          onChange={() => {}}
          readOnly
        />
      );
    }
    return (
      <ExpandingBlankInput
        blankId={blankId}
        value={typed}
        onChange={(next) => updateBlank(blankId, next)}
      />
    );
  }

  const correctText =
    correctTextForBlank(ctx.contentForScoring, blankId) ?? "";
  if (isReviewMode) {
    return (
      <ReviewTypingBlank
        blankId={blankId}
        typed={typedForBlankFromContext(ctx, blankId)}
        correctText={correctText}
      />
    );
  }
  return (
    <ExpandingBlankInput
      blankId={blankId}
      value={typedForBlankFromContext(ctx, blankId)}
      onChange={(next) => updateBlank(blankId, next)}
      ariaLabel={`Пропуск ${blankId}`}
      spellCheck={false}
    />
  );
}

const PARSED_HTML_PROSE_CLASS = cn(
  QUIZ_PROSE_BASE,
  QUIZ_PROSE_EMBEDDED_IMG,
  "text-foreground text-sm md:text-base",
  "leading-loose",
  "[&_audio]:mx-auto [&_audio]:my-2 [&_audio]:block [&_audio]:h-10 [&_audio]:w-full [&_audio]:max-w-lg",
  "[&_video]:mx-auto [&_video]:my-4 [&_video]:aspect-video [&_video]:w-full [&_video]:max-w-3xl [&_video]:rounded-lg",
  "[&_.blank-placeholder]:border-primary/40 [&_.blank-placeholder]:bg-primary/10 [&_.blank-placeholder]:mx-0.5 [&_.blank-placeholder]:my-1 [&_.blank-placeholder]:inline-block [&_.blank-placeholder]:min-h-[1.5rem] [&_.blank-placeholder]:min-w-[4rem] [&_.blank-placeholder]:rounded [&_.blank-placeholder]:border [&_.blank-placeholder]:align-middle",
);

const PARSED_HTML_REVIEW_PROSE_CLASS = cn(
  QUIZ_PROSE_BASE,
  QUIZ_PROSE_EMBEDDED_IMG,
  "text-foreground text-sm md:text-base leading-relaxed",
  "[&_.blank-placeholder]:border-primary/40 [&_.blank-placeholder]:bg-primary/10 [&_.blank-placeholder]:mx-0.5 [&_.blank-placeholder]:my-1 [&_.blank-placeholder]:inline-block [&_.blank-placeholder]:min-h-[1.5rem] [&_.blank-placeholder]:min-w-[4rem] [&_.blank-placeholder]:rounded [&_.blank-placeholder]:border [&_.blank-placeholder]:align-middle",
);

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

  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;

  const patchAssignmentsRef = useRef(patchAssignments);
  patchAssignmentsRef.current = patchAssignments;

  const updateBlank = useCallback((blankId: string, nextValue: string) => {
    patchAssignmentsRef.current({
      ...assignmentsRef.current,
      [blankId]: nextValue,
    });
  }, []);

  const contentForScoring = useMemo(
    () => ({ segments, wordBank, correctMapping }),
    [segments, wordBank, correctMapping],
  );

  const contextValue = useMemo(
    (): FillBlanksParsedHtmlContextValue => ({
      mode,
      isReviewMode,
      assignments,
      updateBlank,
      wordById,
      correctMapping,
      contentForScoring,
      blankIds,
      reviewRawAnswer,
      valueProp,
    }),
    [
      mode,
      isReviewMode,
      assignments,
      updateBlank,
      wordById,
      correctMapping,
      contentForScoring,
      blankIds,
      reviewRawAnswer,
      valueProp,
    ],
  );

  const embedReadyHtml = useMemo(
    () =>
      normalizeEmbeddedImagesInHtml(transformMediaUrlsInHtml(parsedHtml)),
    [parsedHtml],
  );

  const parsedBodyNodes = useMemo(() => {
    return parse(embedReadyHtml, {
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
          return (
            <ParsedHtmlBlankSlot
              key={`fitb-blank-${blankId}`}
              blankId={blankId}
            />
          );
        }
        return undefined;
      },
    });
  }, [embedReadyHtml, isReviewMode]);

  const parsedBody = (
    <FillBlanksParsedHtmlContext.Provider value={contextValue}>
      <div
        className={
          isReviewMode ? PARSED_HTML_REVIEW_PROSE_CLASS : PARSED_HTML_PROSE_CLASS
        }
      >
        {parsedBodyNodes}
      </div>
    </FillBlanksParsedHtmlContext.Provider>
  );

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
    const current = assignmentsRef.current;

    if (overId?.startsWith(FITB_BLANK_PREFIX)) {
      const blankId = overId.slice(FITB_BLANK_PREFIX.length);
      let next = removeWordFromAssignments(current, wordId);
      next = { ...next, [blankId]: wordId };
      patchAssignmentsRef.current(next);
      return;
    }

    if (overId === FITB_BANK_DROP_ID || overId === null) {
      patchAssignmentsRef.current(removeWordFromAssignments(current, wordId));
    }
  }

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
