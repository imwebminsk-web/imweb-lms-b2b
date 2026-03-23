"use client";

import type { SafeTestOption } from "@/app/actions/test-actions";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.types";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PUZZLE_BASE_CSS } from "@/lib/puzzle-mask-css";
import { useEffect, useMemo, useState } from "react";

const CONCRETE_LAYOUT_CSS = `
  .puzzle-pair-row {
    display: flex !important;
    width: 100% !important;
    min-width: 0 !important;
    justify-content: center !important;
    align-items: stretch !important;
    gap: 100px !important;
    box-sizing: border-box !important;
  }
  .puzzle-piece-concrete {
    width: calc(50% - 50px) !important;
    min-width: calc(50% - 50px) !important;
    max-width: calc(50% - 50px) !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
    transition: opacity 0.2s ease;
  }
  .puzzle-resolved-block {
    display: flex !important;
    width: 100% !important;
    min-width: 0 !important;
    justify-content: center !important;
    align-items: stretch !important;
    gap: 0 !important;
    position: relative;
    box-sizing: border-box !important;
    overflow-x: clip !important;
  }
  .puzzle-ui-scope,
  .puzzle-ui-scope *,
  .puzzle-ui-scope *:focus,
  .puzzle-ui-scope *:focus-visible,
  .puzzle-ui-scope *:active {
    outline: none !important;
    box-shadow: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
  .puzzle-ui-scope .puzzle-draggable-source {
    transform: none !important;
  }
  .dark .puzzle-ui-scope .puzzle-filter {
    filter: drop-shadow(0 0 1px rgba(255,255,255,0.2)) drop-shadow(0 4px 6px rgba(0,0,0,0.4));
  }
  .puzzle-ui-scope .puzzle-filter,
  .puzzle-ui-scope .puzzle-left-mask,
  .puzzle-ui-scope .puzzle-right-mask,
  .puzzle-ui-scope [data-draggable],
  .puzzle-ui-scope [role="button"] {
    -webkit-touch-callout: none;
    user-select: none;
  }
  .drag-overlay-container,
  .drag-overlay-container *,
  .drag-overlay-container *:focus,
  .drag-overlay-container *:focus-visible,
  .drag-overlay-container *:active {
    outline: none !important;
    box-shadow: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
`;

export type DndMatchingPair = {
  leftOptionId: string;
  rightOptionId: string;
};

const dragPrefix = "drag-right-";
const dropPrefix = "drop-right-";

function labelLeft(content: Json): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { left?: unknown }).left;
    if (typeof v === "string") return v;
  }
  return "—";
}

function labelRight(content: Json): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { right?: unknown }).right;
    if (typeof v === "string") return v;
  }
  return "—";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type DndMatchingPuzzleQuestionProps = {
  options: SafeTestOption[];
  pairs: DndMatchingPair[];
  onPairsChange: (pairs: DndMatchingPair[]) => void;
};

function DraggableRightPiece({
  rightOptionId,
  label,
  monolithLayout,
}: {
  rightOptionId: string;
  label: string;
  /** Стык −30px только в собранном монолите; при драге родитель переключается на ряд с gap 100px. */
  monolithLayout: boolean;
}) {
  // transform из хука не применяем — движется только DragOverlay.
  const { attributes, listeners, setNodeRef, isDragging, transform: _activeTransform } =
    useDraggable({
      id: `${dragPrefix}${rightOptionId}`,
    });
  void _activeTransform;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "puzzle-draggable-source puzzle-piece-concrete puzzle-filter relative z-[1] h-full min-h-[100px] touch-none",
        monolithLayout && "-ml-[30px]",
        "cursor-grab active:cursor-grabbing",
        isDragging && "pointer-events-none opacity-0",
      )}
      {...listeners}
      {...attributes}
      style={{ transform: "none" }}
    >
      <div className="puzzle-right-mask flex h-full min-h-[100px] w-full min-w-0 items-center justify-center bg-card p-8 pl-14 text-center break-words">
        <span className="text-foreground text-sm font-medium leading-snug md:text-base">
          {label}
        </span>
      </div>
    </div>
  );
}

function PuzzlePairRow({
  leftOption,
  rightOption,
  activeRightId,
}: {
  leftOption: SafeTestOption;
  rightOption: SafeTestOption;
  activeRightId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${dropPrefix}${leftOption.id}`,
  });

  /** Как на сервере: верная пара — один и тот же id слева и справа. */
  const isMatched = rightOption.id === leftOption.id;
  const isDraggingThisAnswer =
    activeRightId !== null && activeRightId === rightOption.id;
  const showMonolith = isMatched && !isDraggingThisAnswer;

  return (
    <li className="w-full min-w-0 overflow-x-clip">
      <div
        className={cn(showMonolith ? "puzzle-resolved-block" : "puzzle-pair-row")}
      >
        <div
          ref={setNodeRef}
          className="puzzle-piece-concrete puzzle-filter relative z-10 h-full min-h-[100px]"
        >
          <div
            className={cn(
              "puzzle-left-mask flex h-full min-h-[100px] w-full items-center justify-center p-8 pr-14 text-center",
              isOver ? "bg-yellow-400/40" : "bg-card",
            )}
          >
            <span className="text-foreground text-sm font-medium leading-snug md:text-base">
              {labelLeft(leftOption.content)}
            </span>
          </div>
        </div>

        <DraggableRightPiece
          rightOptionId={rightOption.id}
          label={labelRight(rightOption.content)}
          monolithLayout={showMonolith}
        />
      </div>
    </li>
  );
}

/**
 * Обмен `rightOptionId` между строкой-источником и строкой-целью (одинаковый смысл, что и swap в handleDragEnd).
 * Возвращает новый массив или `null`, если индексы невалидны.
 */
function handleSwap(
  pairs: DndMatchingPair[],
  sourceLeftId: string,
  targetLeftId: string,
): DndMatchingPair[] | null {
  const next = pairs.map((p) => ({ ...p }));
  const sourceIndex = next.findIndex((p) => p.leftOptionId === sourceLeftId);
  const targetIndex = next.findIndex((p) => p.leftOptionId === targetLeftId);
  if (
    sourceIndex === -1 ||
    targetIndex === -1 ||
    sourceIndex === targetIndex
  ) {
    return null;
  }
  const temp = next[sourceIndex]!.rightOptionId;
  next[sourceIndex]!.rightOptionId = next[targetIndex]!.rightOptionId;
  next[targetIndex]!.rightOptionId = temp;
  return next;
}

export function DndMatchingPuzzleQuestion({
  options,
  pairs,
  onPairsChange,
}: DndMatchingPuzzleQuestionProps) {
  const sortedLeft = useMemo(
    () => [...options].sort((a, b) => a.order_index - b.order_index),
    [options],
  );

  const optionsKey = useMemo(
    () =>
      [...options]
        .map((o) => o.id)
        .sort()
        .join("|"),
    [options],
  );

  useEffect(() => {
    if (options.length === 0) return;
    if (pairs.length === options.length) return;
    const sorted = [...options].sort((a, b) => a.order_index - b.order_index);
    const rights = shuffle(options.map((o) => o.id));
    onPairsChange(
      sorted.map((l, i) => ({
        leftOptionId: l.id,
        rightOptionId: rights[i]!,
      })),
    );
  }, [optionsKey, options.length, pairs.length, onPairsChange, options]);

  const rightByLeft = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pairs) {
      m.set(p.leftOptionId, p.rightOptionId);
    }
    return m;
  }, [pairs]);

  const [activeRightId, setActiveRightId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (!id.startsWith(dragPrefix)) return;
    setActiveRightId(id.slice(dragPrefix.length));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveRightId(null);
    if (!over) return;

    const aid = String(active.id);
    const oid = String(over.id);
    if (!aid.startsWith(dragPrefix) || !oid.startsWith(dropPrefix)) return;

    const draggedRightId = aid.slice(dragPrefix.length);
    const targetLeftId = oid.slice(dropPrefix.length);

    const sourceLeftId = pairs.find(
      (p) => p.rightOptionId === draggedRightId,
    )?.leftOptionId;
    if (!sourceLeftId || sourceLeftId === targetLeftId) return;

    const targetRow = pairs.find((p) => p.leftOptionId === targetLeftId);
    if (!targetRow) return;

    if (
      pairs.find((p) => p.leftOptionId === sourceLeftId)?.rightOptionId !==
      draggedRightId
    ) {
      return;
    }

    const nextPairs = handleSwap(pairs, sourceLeftId, targetLeftId);
    if (nextPairs) onPairsChange(nextPairs);
  }

  const activeOpt = activeRightId
    ? options.find((o) => o.id === activeRightId)
    : undefined;
  const activeLabel = activeOpt ? labelRight(activeOpt.content) : "";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <style>{`${PUZZLE_BASE_CSS}${CONCRETE_LAYOUT_CSS}`}</style>

      <div className="min-w-0 max-w-full">
        <div className="bg-muted/30 border-border/60 max-w-full min-w-0 overflow-x-clip rounded-2xl border p-4 shadow-sm md:p-6">
          <div className="puzzle-ui-scope min-w-0">
            <p className="text-muted-foreground mb-6 min-w-0 text-sm leading-relaxed">
              Верная пара (тот же id слева и справа): монолит{" "}
              <code className="text-foreground text-xs">.puzzle-resolved-block</code> без
              зазора, стык <code className="text-foreground text-xs">-ml-[30px]</code>. Начало
              драга правой детали — строка с{" "}
              <code className="text-foreground text-xs">gap: 100px</code>. Иначе всегда ряд с
              зазором. Жёлтый только слева при{" "}
              <code className="text-foreground text-xs">isOver</code>.
            </p>

            <ul className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-10 overflow-x-clip">
              {sortedLeft.map((leftOpt) => {
                const rid = rightByLeft.get(leftOpt.id);
                const rightOpt = rid
                  ? options.find((o) => o.id === rid)
                  : undefined;
                if (!rightOpt) {
                  return (
                    <li
                      key={leftOpt.id}
                      className="text-muted-foreground text-center text-sm"
                    >
                      Загрузка пары…
                    </li>
                  );
                }
                return (
                  <PuzzlePairRow
                    key={leftOpt.id}
                    leftOption={leftOpt}
                    rightOption={rightOpt}
                    activeRightId={activeRightId}
                  />
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeRightId ? (
          <div className="puzzle-filter drag-overlay-container pointer-events-none relative z-[9999] h-full min-h-[100px] w-[min(100%,22rem)] min-w-0 cursor-grabbing select-none border-0">
            <div className="puzzle-right-mask bg-card flex h-full min-h-[100px] w-full min-w-0 items-center justify-center border-0 p-8 pl-14 text-center break-words select-none">
              <span className="text-foreground text-sm font-medium leading-snug md:text-base">
                {activeLabel}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
