"use client";

import type {
  FillInTheBlanksContent,
  FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useId, useMemo, useState, type ReactNode } from "react";

const WORD_PREFIX = "fitb-word-";
const BLANK_PREFIX = "fitb-blank-";
const BANK_DROP_ID = "fitb-bank";

export const FITB_WORD_PREFIX = WORD_PREFIX;
export const FITB_BLANK_PREFIX = BLANK_PREFIX;
export const FITB_BANK_DROP_ID = BANK_DROP_ID;

export function DroppableBlankSlot({
  blankId,
  assignedWord,
  isOver,
}: {
  blankId: string;
  assignedWord?: FillInTheBlanksWord;
  isOver?: boolean;
}) {
  return (
    <span
      data-blank-id={blankId}
      className={cn(
        "mx-1 inline-flex min-h-[32px] min-w-[80px] items-center justify-center rounded px-3 align-middle text-sm font-medium transition-colors",
        assignedWord
          ? "cursor-grab border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-blue-400 active:cursor-grabbing"
          : isOver
            ? "border-2 border-solid border-blue-400 bg-blue-50 text-transparent select-none"
            : "border-b-2 border-dashed border-slate-300 bg-slate-50 text-transparent select-none",
      )}
    >
      {assignedWord ? assignedWord.text : "blank"}
    </span>
  );
}

export function DraggableWordBankItem({ word }: { word: FillInTheBlanksWord }) {
  const id = `${WORD_PREFIX}${word.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
  });

  return (
    <span
      ref={setNodeRef}
      className={cn(
        "inline-flex touch-none cursor-grab items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-base font-medium text-slate-800 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      {word.text}
    </span>
  );
}

export function WordBankDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: BANK_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      data-fitb-bank
      className="flex min-h-[80px] flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-100 p-5"
    >
      {children}
    </div>
  );
}

/** Слово в слоте: `useDraggable` всегда вызывается (отдельный компонент), без условных хуков. */
function DraggableAssignedWord({
  word,
  blankId,
  isOver,
}: {
  word: FillInTheBlanksWord;
  blankId: string;
  isOver: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${WORD_PREFIX}${word.id}`,
    data: { sourceBlankId: blankId },
  });

  return (
    <span
      ref={setNodeRef}
      className={cn(
        "inline-block touch-none",
        isDragging && "opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      <DroppableBlankSlot
        blankId={blankId}
        assignedWord={word}
        isOver={isOver}
      />
    </span>
  );
}

export function BlankSlotWithDrop({
  blankId,
  assignedWord,
}: {
  blankId: string;
  assignedWord: FillInTheBlanksWord | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${BLANK_PREFIX}${blankId}`,
  });

  return (
    <span ref={setNodeRef} className="inline-block align-middle">
      {assignedWord ? (
        <DraggableAssignedWord
          word={assignedWord}
          blankId={blankId}
          isOver={isOver}
        />
      ) : (
        <DroppableBlankSlot blankId={blankId} isOver={isOver} />
      )}
    </span>
  );
}

export function ReviewBlankSlot({
  blankId,
  userWordId,
  correctWordId,
  wordById,
}: {
  blankId: string;
  userWordId: string | undefined;
  correctWordId: string;
  wordById: Map<string, FillInTheBlanksWord>;
}) {
  const ok = userWordId === correctWordId;
  const userW = userWordId ? wordById.get(userWordId) : undefined;
  const rightW = wordById.get(correctWordId);

  return (
    <span className="mx-1 inline-flex flex-col items-center align-middle">
      <span
        data-blank-id={blankId}
        className={cn(
          "inline-flex min-h-[32px] min-w-[72px] items-center justify-center rounded border px-2 py-1 text-sm font-medium",
          ok
            ? "border-green-500 bg-green-50 text-slate-900"
            : "border-red-500 bg-red-50 text-slate-900",
        )}
      >
        {userW?.text ?? "—"}
      </span>
      {!ok && rightW ? (
        <span className="text-green-700 mt-0.5 max-w-[140px] text-center text-xs leading-tight">
          верно: «{rightW.text}»
        </span>
      ) : null}
    </span>
  );
}

export type FillInTheBlanksQuestionProps = {
  content: FillInTheBlanksContent;
  /** Ответ: blankId → wordId (контролируемый режим с родителя). */
  value?: Record<string, string>;
  onChange?: (assignments: Record<string, string>) => void;
  isReviewMode?: boolean;
  /** Если не задано, берётся из `content.correctMapping`. */
  correctMapping?: Record<string, string>;
};

export function FillInTheBlanksQuestion({
  content,
  value: valueProp,
  onChange,
  isReviewMode,
  correctMapping: correctMappingProp,
}: FillInTheBlanksQuestionProps) {
  const dndId = useId();
  const [internal, setInternal] = useState<Record<string, string>>({});
  const controlled = valueProp !== undefined;
  const assignments = controlled ? valueProp : internal;

  const wordById = useMemo(() => {
    const m = new Map<string, FillInTheBlanksWord>();
    for (const w of content.wordBank) m.set(w.id, w);
    return m;
  }, [content.wordBank]);

  const assignedWordIds = useMemo(
    () => new Set(Object.values(assignments)),
    [assignments],
  );

  /** Порядок как в БД (админка); без shuffle на клиенте — иначе ломается SSR/hydration. */
  const poolWords = useMemo(
    () => content.wordBank.filter((w) => !assignedWordIds.has(w.id)),
    [content.wordBank, assignedWordIds],
  );

  const mapping = correctMappingProp ?? content.correctMapping;

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
    if (!aid.startsWith(WORD_PREFIX)) return;
    const wordId = aid.slice(WORD_PREFIX.length);

    const overId = over ? String(over.id) : null;

    if (overId?.startsWith(BLANK_PREFIX)) {
      const blankId = overId.slice(BLANK_PREFIX.length);
      let next = removeWordFromAssignments(assignments, wordId);
      next = { ...next, [blankId]: wordId };
      patchAssignments(next);
      return;
    }

    if (overId === BANK_DROP_ID || overId === null) {
      patchAssignments(removeWordFromAssignments(assignments, wordId));
    }
  }

  if (isReviewMode) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm leading-relaxed">
          {content.segments.map((seg, i) => {
            if (seg.type === "text") {
              return <span key={i}>{seg.value}</span>;
            }
            const userWid = assignments[seg.id];
            const correctWid = mapping[seg.id];
            return (
              <ReviewBlankSlot
                key={seg.id}
                blankId={seg.id}
                userWordId={userWid}
                correctWordId={correctWid}
                wordById={wordById}
              />
            );
          })}
        </p>
      </div>
    );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-6">
        <p className="text-foreground text-sm leading-relaxed">
          {content.segments.map((seg, i) => {
            if (seg.type === "text") {
              return <span key={i}>{seg.value}</span>;
            }
            const wid = assignments[seg.id];
            const assigned = wid ? wordById.get(wid) : undefined;
            return (
              <BlankSlotWithDrop
                key={seg.id}
                blankId={seg.id}
                assignedWord={assigned}
              />
            );
          })}
        </p>

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
