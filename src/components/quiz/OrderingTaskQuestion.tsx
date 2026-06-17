"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useMemo, useState } from "react";

import { TaskMediaRenderer } from "@/components/quiz/TaskMediaRenderer";
import { ReviewSubQuestionHeader } from "@/components/quiz/ReviewSubQuestionHeader";
import { useLanguage } from "@/components/providers/language-provider";
import type { ReviewItemScore } from "@/lib/quiz-result-scoring";
import {
  type OrderingPlayerElement,
  type OrderingPlayerItem,
  shuffleOrderingIds,
} from "@/lib/ordering-utils";
import { cn } from "@/lib/utils";

export type OrderingTaskQuestionProps = {
  items: OrderingPlayerItem[];
  assignments: Record<string, string[]>;
  onAssignmentsChange?: (next: Record<string, string[]>) => void;
  isReviewMode?: boolean;
  correctByItemId?: Record<string, string[]>;
  reviewItemScores?: Record<string, ReviewItemScore>;
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function SortableOrderingPill({
  element,
  disabled,
  reviewState,
}: {
  element: OrderingPlayerElement;
  disabled?: boolean;
  reviewState?: "correct" | "wrong" | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: element.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "touch-manipulation select-none rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60",
        reviewState === "correct" &&
          "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
        reviewState === "wrong" &&
          "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
        reviewState == null &&
          "border-slate-200 bg-white text-slate-800 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
      )}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {element.text}
    </div>
  );
}

function OrderingSortableItem({
  item,
  orderIds,
  onOrderChange,
  isReviewMode,
  correctOrder,
}: {
  item: OrderingPlayerItem;
  orderIds: string[] | undefined;
  onOrderChange: (ids: string[]) => void;
  isReviewMode: boolean;
  correctOrder?: string[];
}) {
  const { t } = useLanguage();
  const dndId = useId();
  const elementById = useMemo(
    () => new Map(item.elements.map((el) => [el.id, el])),
    [item.elements],
  );

  const [localOrderIds, setLocalOrderIds] = useState<string[]>(() => {
    if (orderIds && orderIds.length === item.elements.length) {
      return orderIds;
    }
    return shuffleOrderingIds(item.elements.map((el) => el.id));
  });

  useEffect(() => {
    if (
      orderIds &&
      orderIds.length === item.elements.length &&
      !arraysEqual(orderIds, localOrderIds)
    ) {
      setLocalOrderIds(orderIds);
    }
  }, [orderIds, item.elements.length, localOrderIds]);

  useEffect(() => {
    if (!orderIds || orderIds.length !== item.elements.length) {
      onOrderChange(localOrderIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- начальная передача перемешанного порядка родителю
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || isReviewMode) return;
    const oldIndex = localOrderIds.indexOf(String(active.id));
    const newIndex = localOrderIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localOrderIds, oldIndex, newIndex);
    setLocalOrderIds(next);
    onOrderChange(next);
  }

  const orderedElements = localOrderIds
    .map((id) => elementById.get(id))
    .filter((el): el is OrderingPlayerElement => Boolean(el));

  const isFullyCorrect =
    isReviewMode &&
    correctOrder != null &&
    arraysEqual(localOrderIds, correctOrder);

  const showCorrectOrderBlock =
    isReviewMode &&
    correctOrder != null &&
    correctOrder.length > 0 &&
    !isFullyCorrect;

  const correctElements = (correctOrder ?? [])
    .map((id) => elementById.get(id))
    .filter((el): el is OrderingPlayerElement => Boolean(el));

  return (
    <div className="space-y-3">
      {item.text.trim() ? (
        <TaskMediaRenderer
          html={item.text}
          className="text-foreground text-base font-medium leading-snug md:text-lg [&_strong]:font-semibold"
          isReviewMode={isReviewMode}
        />
      ) : null}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localOrderIds} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {orderedElements.map((element, index) => {
              let reviewState: "correct" | "wrong" | null = null;
              if (isReviewMode && correctOrder) {
                const correctId = correctOrder[index];
                reviewState = element.id === correctId ? "correct" : "wrong";
              }
              return (
                <SortableOrderingPill
                  key={element.id}
                  element={element}
                  disabled={isReviewMode}
                  reviewState={reviewState}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {showCorrectOrderBlock ? (
        <div className="mt-4 rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-muted-foreground mb-2 text-sm">
            {t("quizResult.correctOrder")}
          </p>
          <div className="flex flex-wrap gap-2">
            {correctElements.map((element) => (
              <span
                key={element.id}
                className="rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                {element.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {isReviewMode && correctOrder ? (
        <p className="text-muted-foreground text-xs">
          {isFullyCorrect
            ? "Верный порядок."
            : "Красным отмечены элементы не на своих местах."}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Перетащите карточки, чтобы выстроить правильный порядок.
        </p>
      )}
    </div>
  );
}

export function OrderingTaskQuestion({
  items,
  assignments,
  onAssignmentsChange,
  isReviewMode = false,
  correctByItemId,
  reviewItemScores,
}: OrderingTaskQuestionProps) {
  function updateItemOrder(itemId: string, orderIds: string[]) {
    onAssignmentsChange?.({ ...assignments, [itemId]: orderIds });
  }

  return (
    <div className="flex flex-col">
      <hr
        className="my-8 border-slate-200 dark:border-slate-700"
        aria-hidden
      />
      {items.map((item, index) => (
        <section
          key={item.id}
          className={cn(
            "space-y-2",
            index !== items.length - 1 &&
              "mb-10 border-b border-slate-200 pb-10 dark:border-slate-700",
          )}
        >
          {isReviewMode && reviewItemScores?.[item.id] ? (
            <ReviewSubQuestionHeader
              index={index}
              earnedPoints={reviewItemScores[item.id]!.earned}
              maxPoints={reviewItemScores[item.id]!.max}
              isCorrect={reviewItemScores[item.id]!.isCorrect}
              pendingReview={reviewItemScores[item.id]!.pendingReview}
            />
          ) : items.length > 1 ? (
            <p className="mb-4 font-medium text-slate-500 dark:text-slate-400">
              Вопрос {index + 1}
            </p>
          ) : null}
          <OrderingSortableItem
            item={item}
            orderIds={assignments[item.id]}
            onOrderChange={(ids) => updateItemOrder(item.id, ids)}
            isReviewMode={isReviewMode}
            correctOrder={correctByItemId?.[item.id]}
          />
        </section>
      ))}
    </div>
  );
}

export function isOrderingSelectionComplete(
  items: OrderingPlayerItem[],
  assignments: Record<string, string[]>,
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => {
    const order = assignments[item.id];
    return (
      Array.isArray(order) &&
      order.length === item.elements.length &&
      new Set(order).size === item.elements.length
    );
  });
}
