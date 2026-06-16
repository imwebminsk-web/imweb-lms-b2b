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
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type DndMatchingPair = {
  leftOptionId: string;
  rightOptionId: string;
};

const dragPrefix = "drag-right-";
const leftDropPrefix = "drop-left-";
/** Нижняя зона снятия пары (вместо бокового банка). */
const unassignDropId = "drop-unassign";
const USE_NEW_MASK = true;

const PIECE_80 = "w-[80%] min-w-[80%] shrink-0";

const leftPieceSurface = cn(
  "bg-gradient-to-br from-[hsl(40,38%,90%)] via-[hsl(36,32%,82%)] to-[hsl(30,26%,68%)]",
  "dark:from-[hsl(30,22%,28%)] dark:via-[hsl(26,18%,20%)] dark:to-[hsl(22,14%,14%)]",
);

const rightPieceSurface = cn(
  "bg-gradient-to-br from-[hsl(38,34%,86%)] via-[hsl(32,28%,76%)] to-[hsl(28,22%,64%)]",
  "dark:from-[hsl(28,20%,26%)] dark:via-[hsl(24,16%,18%)] dark:to-[hsl(20,12%,12%)]",
  "border border-black/18 shadow-[inset_2px_0_0_rgba(255,255,255,0.45),inset_0_2px_0_rgba(255,255,255,0.3),inset_-2px_-4px_8px_rgba(0,0,0,0.14),0_2px_5px_rgba(0,0,0,0.12)]",
  "dark:border-white/12 dark:shadow-[inset_2px_0_0_rgba(255,255,255,0.08),inset_0_2px_0_rgba(255,255,255,0.05),inset_-2px_-6px_10px_rgba(0,0,0,0.42),0_3px_8px_rgba(0,0,0,0.4)]",
);

/** Шип на правом краю только левой половины (стык по центру ряда). */
const tabAfterBase = cn(
  "after:pointer-events-none after:absolute after:top-1/2 after:-right-[15px] after:z-20 after:h-8 after:w-8 after:-translate-y-1/2 after:rounded-full after:content-['']",
  "after:shadow-[inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.12)] dark:after:shadow-[inset_0_1px_2px_rgba(255,255,255,0.12),inset_0_-2px_4px_rgba(0,0,0,0.35)]",
);

const tabAfterNormal = cn(
  tabAfterBase,
  "after:bg-gradient-to-br after:from-[hsl(40,38%,90%)] after:via-[hsl(36,32%,82%)] after:to-[hsl(30,26%,68%)]",
  "dark:after:from-[hsl(30,22%,28%)] dark:after:via-[hsl(26,18%,20%)] dark:after:to-[hsl(22,14%,14%)]",
);

const tabAfterHighlight = cn(
  tabAfterBase,
  "after:bg-gradient-to-br after:from-yellow-100 after:via-yellow-200 after:to-amber-200",
  "dark:after:from-yellow-800 dark:after:via-yellow-900 dark:after:to-amber-950",
);

const highlightShell = cn(
  "ring-4 ring-yellow-400",
  "bg-yellow-100 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]",
  "dark:bg-yellow-950/55 dark:ring-yellow-400 dark:shadow-[inset_0_0_0_1px_rgba(250,204,21,0.2)]",
);

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

/** Детерминированная перестановка правых по строкам (одинаково на SSR и клиенте). */
function seededSlotMap(leftIds: string[], rightIds: string[]): Record<string, string> {
  const sortedR = [...rightIds].sort();
  const n = sortedR.length;
  if (n === 0) return {};
  const offset =
    Math.abs(
      leftIds.reduce((acc, id, i) => acc + id.charCodeAt(0) * (i + 1), 0),
    ) % n;
  const rotated = [...sortedR.slice(offset), ...sortedR.slice(0, offset)];
  const m: Record<string, string> = {};
  leftIds.forEach((l, i) => {
    m[l] = rotated[i % n]!;
  });
  return m;
}

/**
 * Слоты: у каждой строки (левый id) ровно один правый id, биекция.
 * Сначала фиксируем пары, затем оставшиеся права (по сортировке id) — на свободные строки.
 */
function mergePairsIntoSlots(
  leftIds: string[],
  rightIds: string[],
  pairs: DndMatchingPair[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const usedRights = new Set<string>();
  for (const p of pairs) {
    out[p.leftOptionId] = p.rightOptionId;
    usedRights.add(p.rightOptionId);
  }
  const freeLefts = leftIds.filter((l) => !pairs.some((p) => p.leftOptionId === l));
  const pool = rightIds.filter((r) => !usedRights.has(r));
  if (freeLefts.length > 0 && pool.length > 0) {
    const sub = seededSlotMap(freeLefts, pool);
    for (const l of freeLefts) {
      out[l] = sub[l] ?? pool[0]!;
    }
  }
  return out;
}

export type DndMatchingPuzzleQuestionProps = {
  options: SafeTestOption[];
  pairs: DndMatchingPair[];
  onPairsChange: (pairs: DndMatchingPair[]) => void;
  readOnly?: boolean;
};

function DraggableRightItem({
  rightOptionId,
  label,
  isLocked,
  onDisconnect,
}: {
  rightOptionId: string;
  label: string;
  isLocked: boolean;
  onDisconnect: (rightId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${dragPrefix}${rightOptionId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative z-0 flex h-full min-h-[64px] w-full min-w-0 shrink-0 touch-none items-center rounded-r-xl rounded-l-none border-y border-r py-3 pr-4 pl-9 text-sm font-semibold text-foreground active:cursor-grabbing",
        isLocked ? "cursor-pointer" : "cursor-grab",
        isLocked
          ? cn(
              "border-black/18 dark:border-white/12",
              "bg-gradient-to-br from-[hsl(38,34%,86%)] via-[hsl(32,28%,76%)] to-[hsl(28,22%,64%)]",
              "dark:from-[hsl(28,20%,26%)] dark:via-[hsl(24,16%,18%)] dark:to-[hsl(20,12%,12%)]",
              "shadow-[inset_2px_0_0_rgba(255,255,255,0.45),inset_0_2px_0_rgba(255,255,255,0.3),inset_-2px_-4px_8px_rgba(0,0,0,0.14),4px_0_6px_-1px_rgba(0,0,0,0.1)]",
              "dark:shadow-[inset_2px_0_0_rgba(255,255,255,0.08),inset_0_2px_0_rgba(255,255,255,0.05),inset_-2px_-6px_10px_rgba(0,0,0,0.42),4px_0_6px_-1px_rgba(0,0,0,0.3)]",
            )
          : cn("border-black/18 dark:border-white/12", rightPieceSurface),
        "border-l-0",
        isDragging && "opacity-40",
      )}
      style={{
        WebkitMaskImage:
          "radial-gradient(circle 16px at 0 center, transparent 16px, black 16.5px)",
        maskImage:
          "radial-gradient(circle 16px at 0 center, transparent 16px, black 16.5px)",
      }}
      onClick={() => {
        if (isLocked) onDisconnect(rightOptionId);
      }}
      {...listeners}
      {...attributes}
    >
      <span className="relative z-[2] min-w-0 flex-1 truncate">{label}</span>
    </div>
  );
}

function PuzzleRow({
  left,
  slotRight,
  isLocked,
  onDisconnect,
}: {
  left: SafeTestOption;
  slotRight: SafeTestOption;
  isLocked: boolean;
  onDisconnect: (rightId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${leftDropPrefix}${left.id}`,
  });
  const glow = isOver;

  return (
    <div className="flex w-full items-stretch gap-0">
      <div
        className={cn(
          "relative flex w-1/2 min-w-0 min-h-[64px] overflow-visible",
          isLocked ? "justify-end" : "justify-start",
        )}
      >
        {USE_NEW_MASK ? (
          <div
            className={cn(
              "relative z-10 w-[80%] min-w-[80%] shrink-0 drop-shadow-sm",
              isLocked && "translate-x-[16px]",
            )}
          >
            <div
              className={cn(
                "flex min-h-[64px] w-full items-center rounded-l-xl rounded-r-none border border-black/12 border-r-0 border-r-transparent py-4 pl-4 pr-[32px] dark:border-white/8",
                glow
                  ? "bg-yellow-100/95 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.25)] ring-2 ring-yellow-400/70 dark:bg-yellow-900/50 dark:shadow-[inset_0_0_0_1px_rgba(250,204,21,0.15)] dark:ring-yellow-400/50"
                  : leftPieceSurface,
              )}
              style={{
                WebkitMaskImage:
                  "linear-gradient(black, black), radial-gradient(circle 16px at center, black 16px, transparent 16px)",
                WebkitMaskSize: "calc(100% - 16px) 100%, 32px 32px",
                WebkitMaskPosition: "left top, right center",
                WebkitMaskRepeat: "no-repeat, no-repeat",
                maskImage:
                  "linear-gradient(black, black), radial-gradient(circle 16px at center, black 16px, transparent 16px)",
                maskSize: "calc(100% - 16px) 100%, 32px 32px",
                maskPosition: "left top, right center",
                maskRepeat: "no-repeat, no-repeat",
              }}
            >
              <span className="relative z-[1] min-w-0 text-sm font-semibold leading-snug text-foreground">
                {labelLeft(left.content)}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative z-10 flex min-h-[64px] items-center overflow-visible rounded-l-xl rounded-r-none border border-black/12 border-r-0 border-r-transparent bg-green-500/30 py-3 pl-4 pr-7 drop-shadow-sm ring-2 ring-green-500 dark:border-white/8",
              PIECE_80,
              isLocked && "translate-x-[16px]",
              glow
                ? "bg-yellow-100/95 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.25)] ring-2 ring-yellow-400/70 dark:bg-yellow-900/50 dark:shadow-[inset_0_0_0_1px_rgba(250,204,21,0.15)] dark:ring-yellow-400/50"
                : leftPieceSurface,
              glow ? tabAfterHighlight : tabAfterNormal,
            )}
          >
            <span className="relative z-[1] min-w-0 text-sm font-semibold leading-snug text-foreground">
              {labelLeft(left.content)}
            </span>
          </div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex w-1/2 min-w-0 min-h-[64px] overflow-visible",
          isLocked ? "justify-start" : "justify-end",
        )}
      >
        <div className={PIECE_80}>
          <DraggableRightItem
            rightOptionId={slotRight.id}
            label={labelRight(slotRight.content)}
            isLocked={isLocked}
            onDisconnect={onDisconnect}
          />
        </div>
      </div>
    </div>
  );
}

function UnassignDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: unassignDropId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-center text-muted-foreground text-xs",
        isOver && highlightShell,
      )}
    >
      Перетащите сюда, чтобы снять пару с ответа.
    </div>
  );
}

function findLeftRowForRight(
  slotByLeft: Record<string, string>,
  rightId: string,
): string | undefined {
  for (const [leftId, rid] of Object.entries(slotByLeft)) {
    if (rid === rightId) return leftId;
  }
  return undefined;
}

export function DndMatchingPuzzleQuestion({
  options,
  pairs,
  onPairsChange,
  readOnly = false,
}: DndMatchingPuzzleQuestionProps) {
  const dndId = useId();
  const leftOrdered = useMemo(
    () => [...options].sort((a, b) => a.order_index - b.order_index),
    [options],
  );
  const rightOrdered = useMemo(
    () => [...options].sort((a, b) => a.order_index - b.order_index),
    [options],
  );

  const leftIds = useMemo(() => leftOrdered.map((l) => l.id), [leftOrdered]);
  const rightIds = useMemo(() => rightOrdered.map((r) => r.id), [rightOrdered]);

  const [slotByLeft, setSlotByLeft] = useState<Record<string, string>>({});
  const [activeRightId, setActiveRightId] = useState<string | null>(null);

  const layoutKey = useMemo(() => `${leftIds.join(",")}|${rightIds.join(",")}`, [leftIds, rightIds]);

  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;

  /** Только смена вопроса/опций: не подписываемся на `pairs`, иначе сбросит перестановку после каждого drag. */
  useEffect(() => {
    if (leftIds.length === 0 || rightIds.length === 0) return;
    setSlotByLeft(mergePairsIntoSlots(leftIds, rightIds, pairsRef.current));
  }, [layoutKey, leftIds, rightIds]);

  const rightById = useMemo(() => {
    const map = new Map<string, SafeTestOption>();
    for (const o of options) map.set(o.id, o);
    return map;
  }, [options]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    if (!activeId.startsWith(dragPrefix)) return;
    setActiveRightId(activeId.slice(dragPrefix.length));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveRightId(null);

    if (!activeId.startsWith(dragPrefix)) return;
    const draggedRightId = activeId.slice(dragPrefix.length);
    const sourceRowId = pairs.find((p) => p.rightOptionId === draggedRightId)?.leftOptionId;

    if (!overId || overId === unassignDropId) {
      if (sourceRowId === undefined) return;
      onPairsChange(pairs.filter((p) => p.leftOptionId !== sourceRowId));
      return;
    }

    if (!overId.startsWith(leftDropPrefix)) return;
    const targetRowId = overId.slice(leftDropPrefix.length);

    const L_src = findLeftRowForRight(slotByLeft, draggedRightId);
    if (L_src === undefined) return;
    if (L_src === targetRowId) {
      const alreadyPaired = pairs.some(
        (p) => p.leftOptionId === targetRowId && p.rightOptionId === draggedRightId,
      );
      if (alreadyPaired) return;
      const next = pairs.filter(
        (p) => p.leftOptionId !== targetRowId && p.rightOptionId !== draggedRightId,
      );
      next.push({ leftOptionId: targetRowId, rightOptionId: draggedRightId });
      onPairsChange(next);
      return;
    }

    const rAtTarget = slotByLeft[targetRowId]!;
    setSlotByLeft((prev) => ({
      ...prev,
      [L_src]: rAtTarget,
      [targetRowId]: draggedRightId,
    }));

    const existingPieceId = pairs.find((p) => p.leftOptionId === targetRowId)?.rightOptionId;

    const next = pairs.filter(
      (p) =>
        p.leftOptionId !== targetRowId &&
        p.rightOptionId !== draggedRightId &&
        (sourceRowId === undefined || p.leftOptionId !== sourceRowId),
    );

    next.push({ leftOptionId: targetRowId, rightOptionId: draggedRightId });

    if (existingPieceId !== undefined && sourceRowId !== undefined) {
      next.push({ leftOptionId: sourceRowId, rightOptionId: existingPieceId });
    }

    onPairsChange(next);
  }

  const handleDisconnect = (rightId: string) => {
    const next = pairs.filter((p) => p.rightOptionId !== rightId);
    onPairsChange(next);
  };

  function handleMobilePairSelect(leftOptionId: string, rightOptionId: string) {
    if (readOnly) return;

    if (!rightOptionId) {
      onPairsChange(pairs.filter((p) => p.leftOptionId !== leftOptionId));
      return;
    }

    const previousLeftForRight = pairs.find(
      (p) => p.rightOptionId === rightOptionId,
    )?.leftOptionId;

    const next = pairs.filter(
      (p) => p.leftOptionId !== leftOptionId && p.rightOptionId !== rightOptionId,
    );
    next.push({ leftOptionId: leftOptionId, rightOptionId });
    onPairsChange(next);

    // Синхронизация визуального размещения для desktop после resize.
    setSlotByLeft((prev) => {
      const out = { ...prev };
      const oldRightAtLeft = out[leftOptionId];
      if (
        previousLeftForRight !== undefined &&
        previousLeftForRight !== leftOptionId &&
        oldRightAtLeft
      ) {
        out[previousLeftForRight] = oldRightAtLeft;
      }
      out[leftOptionId] = rightOptionId;
      return out;
    });
  }

  const activeOpt = activeRightId ? rightById.get(activeRightId) : undefined;

  const overlayClasses = cn(
    "flex min-h-[64px] w-[80%] min-w-[80%] shrink-0 items-center rounded-r-xl rounded-l-none border-y border-r border-black/18 py-3 pr-4 pl-3 text-sm font-semibold text-foreground shadow-xl dark:border-white/12",
    rightPieceSurface,
    "border-l-0",
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        <div className="mb-6 space-y-2 text-sm text-muted-foreground">
          <p>Соберите пазл, подобрав правильную пару к каждому вопросу:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Соединить:</strong> перетащите ответ из правой колонки к вопросу в левой.</li>
            <li><strong>Заменить:</strong> бросьте новый ответ прямо поверх уже собранного пазла.</li>
            <li><strong>Разъединить:</strong> просто кликните по собранной паре.</li>
          </ul>
        </div>

        <div className="hidden md:block space-y-4">
          <div className="flex w-full flex-col gap-4">
            {leftOrdered.map((left) => {
              const currentRightId = slotByLeft[left.id];
              const slotRight = currentRightId ? rightById.get(currentRightId) : undefined;
              const isConnected = currentRightId
                ? pairs.some(
                    (p) =>
                      p.leftOptionId === left.id && p.rightOptionId === currentRightId,
                  )
                : false;
              if (!slotRight) return null;
              return (
                <PuzzleRow
                  key={left.id}
                  left={left}
                  slotRight={slotRight}
                  isLocked={isConnected}
                  onDisconnect={handleDisconnect}
                />
              );
            })}
          </div>
          <UnassignDropZone />
        </div>

        <div className="block md:hidden space-y-4">
          {leftOrdered.map((left) => {
            const selectedRightId =
              pairs.find((p) => p.leftOptionId === left.id)?.rightOptionId ?? "";
            return (
              <div
                key={`mobile-${left.id}`}
                className="w-full rounded-xl border p-4 space-y-3 bg-white dark:bg-zinc-800"
              >
                <p className="font-medium text-sm">{labelLeft(left.content)}</p>
                <select
                  className="w-full rounded-lg border bg-background p-3 text-sm"
                  value={selectedRightId}
                  onChange={(e) =>
                    handleMobilePairSelect(left.id, e.target.value)
                  }
                  disabled={readOnly}
                >
                  <option value="">- Выберите ответ -</option>
                  {rightOrdered.map((right) => (
                    <option key={`mobile-opt-${left.id}-${right.id}`} value={right.id}>
                      {labelRight(right.content)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOpt ? (
          <div className={overlayClasses}>
            <span className="min-w-0 flex-1 truncate">
              {labelRight(activeOpt.content)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
