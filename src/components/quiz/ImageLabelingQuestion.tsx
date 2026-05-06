"use client";

import type { SafeTestOption } from "@/app/actions/test-actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

export type ImageLabelingImage = {
  id: string;
  url: string;
  title?: string | null;
};

export type ImageLabelingWord = {
  id: string;
  text: string;
};

export type ImageLabelingQuestionProps = {
  images: ImageLabelingImage[];
  words: ImageLabelingWord[];
  assignments: Record<string, string | null>;
  onAssignmentsChange?: (next: Record<string, string | null>) => void;
  isReviewMode?: boolean;
};

const WORD_PREFIX = "il-word-";
const SLOT_PREFIX = "il-slot-";
const BANK_ID = "il-bank";

export function buildAssignmentsFromLabelPairs(
  labelPairs: { imageId: string; wordId: string }[] | null,
  imageIds: string[],
): Record<string, string | null> {
  const map = new Map((labelPairs ?? []).map((p) => [p.imageId, p.wordId] as const));
  return Object.fromEntries(imageIds.map((id) => [id, map.get(id) ?? null] as const));
}

function isPairStyleLabeling(
  images: ImageLabelingImage[],
  words: ImageLabelingWord[],
): boolean {
  if (images.length === 0) return false;
  return images.every((img) => words.some((w) => w.id === img.id));
}

export function imageLabelingPairsFromAssignments(
  assignments: Record<string, string | null>,
  imageIds: string[],
): { imageId: string; wordId: string }[] {
  return imageIds.map((imageId) => ({
    imageId,
    wordId: assignments[imageId]!,
  }));
}

export function isImageLabelingComplete(
  assignments: Record<string, string | null>,
  imageIds: string[],
): boolean {
  if (imageIds.length === 0) return false;
  return imageIds.every(
    (id) =>
      assignments[id] != null &&
      assignments[id] !== "" &&
      typeof assignments[id] === "string",
  );
}

function correctTextFromPairContent(rec: Record<string, unknown>): string {
  const ct = rec.correctText;
  if (typeof ct === "string" && ct.length > 0) return ct;
  const cw = rec.correctWord;
  if (typeof cw === "string" && cw.length > 0) return cw;
  return "";
}

export function parseImageLabelingOptions(options: SafeTestOption[]): {
  images: ImageLabelingImage[];
  words: ImageLabelingWord[];
} {
  const sorted = [...options].sort((a, b) => a.order_index - b.order_index);
  const images: ImageLabelingImage[] = [];
  const words: ImageLabelingWord[] = [];

  for (const o of sorted) {
    const c = o.content;
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const rec = c as Record<string, unknown>;
    const imageUrl = rec.imageUrl;
    const pairText =
      typeof imageUrl === "string" && imageUrl.length > 0
        ? correctTextFromPairContent(rec)
        : "";
    if (pairText.length > 0) {
      const title = rec.title;
      images.push({
        id: o.id,
        url: imageUrl as string,
        title: typeof title === "string" ? title : null,
      });
      words.push({ id: o.id, text: pairText });
      continue;
    }
  }

  for (const o of sorted) {
    const c = o.content;
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const rec = c as Record<string, unknown>;
    if (correctTextFromPairContent(rec).length > 0) continue;
    const imageUrl = rec.imageUrl;
    if (typeof imageUrl === "string" && imageUrl.length > 0) {
      const title = rec.title;
      images.push({
        id: o.id,
        url: imageUrl,
        title: typeof title === "string" ? title : null,
      });
      continue;
    }
    const labelText = rec.labelText ?? rec.text;
    if (typeof labelText === "string" && labelText.length > 0) {
      words.push({ id: o.id, text: labelText });
    }
  }

  return { images, words };
}

function clearWordFromSlots(
  prev: Record<string, string | null>,
  wordId: string,
): Record<string, string | null> {
  const next = { ...prev };
  for (const k of Object.keys(next)) {
    if (next[k] === wordId) {
      next[k] = null;
    }
  }
  return next;
}

function DraggableWordPill({ word }: { word: ImageLabelingWord }) {
  const id = `${WORD_PREFIX}${word.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
  });

  return (
    <span
      ref={setNodeRef}
      className={cn(
        "touch-none cursor-grab rounded-full border border-border bg-secondary px-3 py-1.5 text-sm font-medium shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      {word.text}
    </span>
  );
}

function DraggableWordInSlot({
  word,
  imageId,
}: {
  word: ImageLabelingWord;
  imageId: string;
}) {
  const id = `${WORD_PREFIX}${word.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { sourceImageId: imageId },
  });

  return (
    <span
      ref={setNodeRef}
      className={cn(
        "touch-none inline-flex cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      <span className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-md">
        {word.text}
      </span>
    </span>
  );
}

function ImageRowWithDrop({
  img,
  assignedWord,
}: {
  img: ImageLabelingImage;
  assignedWord: ImageLabelingWord | undefined;
}) {
  const slotId = `${SLOT_PREFIX}${img.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-sm font-medium">{img.title || "Изображение"}</p>
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-border bg-muted/20 transition-shadow",
          isOver && "ring-2 ring-inset ring-primary",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.title ?? ""}
          className="mx-auto max-h-80 w-full object-contain"
          draggable={false}
        />
        <div
          ref={setNodeRef}
          className={cn(
            "absolute inset-0 z-10 transition-colors",
            isOver && "bg-black/10",
          )}
          aria-hidden
        />
        {assignedWord ? (
          <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2">
            <DraggableWordInSlot word={assignedWord} imageId={img.id} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function WordBankDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: BANK_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[72px] flex-wrap gap-2 rounded-lg border p-3 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
      )}
    >
      {children}
    </div>
  );
}

function ImageLabelingReviewView({
  images,
  words,
  assignments,
}: {
  images: ImageLabelingImage[];
  words: ImageLabelingWord[];
  assignments: Record<string, string | null>;
}) {
  const wordById = new Map(words.map((w) => [w.id, w]));
  const pairStyle = isPairStyleLabeling(images, words);

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => {
          const assignedWordId = assignments[img.id] ?? null;
          const assignedText = assignedWordId
            ? (wordById.get(assignedWordId)?.text ?? "—")
            : "—";
          const isCorrect = pairStyle && assignedWordId === img.id;
          const correctText = wordById.get(img.id)?.text ?? "—";

          return (
            <li key={img.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2 pb-2">
                <p className="line-clamp-1 text-sm font-medium">
                  {img.title || "Изображение"}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    isCorrect
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
                  )}
                >
                  {isCorrect ? "Верно" : "Ошибка"}
                </Badge>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.title ?? ""}
                className="mx-auto max-h-80 w-full rounded-lg border border-border bg-muted/20 object-contain"
                draggable={false}
              />
              <div className="mt-3 text-sm">
                <p>
                  Ваш ответ: <span className="font-medium">{assignedText}</span>
                </p>
                {!isCorrect ? (
                  <p className="text-muted-foreground">
                    Правильно: <span className="font-medium">{correctText}</span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ImageLabelingPlayView({
  images,
  words,
  assignments,
  onAssignmentsChange,
}: {
  images: ImageLabelingImage[];
  words: ImageLabelingWord[];
  assignments: Record<string, string | null>;
  onAssignmentsChange: (next: Record<string, string | null>) => void;
}) {
  const wordById = new Map(words.map((w) => [w.id, w]));
  const assignedIds = new Set(
    Object.values(assignments).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    ),
  );
  const poolWords = words.filter((w) => !assignedIds.has(w.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const aid = String(active.id);
    if (!aid.startsWith(WORD_PREFIX)) return;
    const wordId = aid.slice(WORD_PREFIX.length);

    const overId = over ? String(over.id) : null;

    if (overId?.startsWith(SLOT_PREFIX)) {
      const imageId = overId.slice(SLOT_PREFIX.length);
      let next = clearWordFromSlots(assignments, wordId);
      next = { ...next, [imageId]: wordId };
      onAssignmentsChange(next);
      return;
    }

    if (overId === BANK_ID || overId === null) {
      onAssignmentsChange(clearWordFromSlots(assignments, wordId));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-medium">
            Перетащите слово на картинку; снизу — банк неназначенных слов
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {images.map((img) => {
              const wid = assignments[img.id] ?? null;
              const assigned = wid ? wordById.get(wid) : undefined;
              return (
                <ImageRowWithDrop
                  key={img.id}
                  img={img}
                  assignedWord={assigned}
                />
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-medium">Банк слов</p>
          <WordBankDropZone>
            {poolWords.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                Все слова назначены.
              </span>
            ) : (
              poolWords.map((w) => <DraggableWordPill key={w.id} word={w} />)
            )}
          </WordBankDropZone>
        </div>
      </div>
    </DndContext>
  );
}

export function ImageLabelingQuestion({
  images,
  words,
  assignments,
  onAssignmentsChange,
  isReviewMode,
}: ImageLabelingQuestionProps) {
  if (isReviewMode) {
    return (
      <ImageLabelingReviewView
        images={images}
        words={words}
        assignments={assignments}
      />
    );
  }

  if (!onAssignmentsChange) {
    throw new Error(
      "ImageLabelingQuestion: передайте onAssignmentsChange, если isReviewMode не задан",
    );
  }

  return (
    <ImageLabelingPlayView
      images={images}
      words={words}
      assignments={assignments}
      onAssignmentsChange={onAssignmentsChange}
    />
  );
}
