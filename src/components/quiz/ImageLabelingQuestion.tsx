"use client";

import { useLanguage } from "@/components/providers/language-provider";
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
import { Check, X } from "lucide-react";
import { useId, type ReactNode } from "react";

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
        "inline-flex touch-none cursor-grab items-center justify-center rounded-full border border-border bg-secondary px-4 py-2 text-center text-base font-medium shadow-sm active:cursor-grabbing",
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
      <div
        ref={setNodeRef}
        className={cn(
          "relative rounded-md border border-border bg-slate-50 p-2 transition-[box-shadow,border-color,background-color] dark:bg-slate-900/50",
          isOver && "border-primary bg-primary/5 ring-2 ring-primary",
        )}
      >
        <div className="relative overflow-hidden rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.title ?? "Изображение"}
            className="mx-auto max-h-80 w-full object-contain"
            draggable={false}
          />
        </div>
        {isOver ? (
          <div
            className="pointer-events-none absolute inset-2 z-10 rounded-md bg-primary/10"
            aria-hidden
          />
        ) : null}
        {assignedWord ? (
          <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
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
        "flex min-h-[72px] flex-wrap gap-3 rounded-lg border p-3 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
      )}
    >
      {children}
    </div>
  );
}

type ImageLabelReviewState = "correct" | "incorrect" | "missed";

function resolveImageLabelReviewState(
  imageId: string,
  assignedWordId: string | null,
  pairStyle: boolean,
): ImageLabelReviewState {
  if (!assignedWordId) return "missed";
  if (pairStyle && assignedWordId === imageId) return "correct";
  return "incorrect";
}

function imageLabelReviewContainerClass(state: ImageLabelReviewState): string {
  switch (state) {
    case "correct":
      return "border-transparent bg-emerald-50/30 ring-4 ring-emerald-500 dark:bg-emerald-950/20";
    case "incorrect":
      return "border-transparent bg-red-50/30 ring-4 ring-destructive dark:bg-red-950/20";
    case "missed":
      return "border-4 border-dashed border-destructive/50 bg-muted/30 ring-0";
  }
}

function ImageLabelReviewBadge({ state }: { state: ImageLabelReviewState }) {
  const { t } = useLanguage();

  if (state === "correct") {
    return (
      <Badge
        className="absolute top-2 right-2 z-20 gap-1 border-emerald-600/30 bg-emerald-500/95 px-2 py-0.5 text-emerald-50 shadow-md hover:bg-emerald-500/95"
        aria-hidden
      >
        <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
        {t("quizResult.correct")}
      </Badge>
    );
  }

  if (state === "incorrect") {
    return (
      <Badge
        variant="destructive"
        className="absolute top-2 right-2 z-20 gap-1 px-2 py-0.5 shadow-md"
        aria-hidden
      >
        <X className="size-3.5 shrink-0" strokeWidth={2.5} />
        {t("quizResult.incorrect")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="absolute top-2 right-2 z-20 border-destructive/50 bg-destructive/10 px-2 py-0.5 text-destructive shadow-md"
      aria-hidden
    >
      {t("quizResult.missed")}
    </Badge>
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
  const { t } = useLanguage();
  const wordById = new Map(words.map((w) => [w.id, w]));
  const pairStyle = isPairStyleLabeling(images, words);

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => {
          const assignedWordId = assignments[img.id] ?? null;
          const assignedText = assignedWordId
            ? (wordById.get(assignedWordId)?.text ?? "—")
            : t("quizResult.puzzleNoAnswer");
          const reviewState = resolveImageLabelReviewState(
            img.id,
            assignedWordId,
            pairStyle,
          );
          const isCorrect = reviewState === "correct";
          const correctText = wordById.get(img.id)?.text ?? "—";

          return (
            <li
              key={img.id}
              className={cn(
                "overflow-hidden rounded-xl border bg-card p-3",
                imageLabelReviewContainerClass(reviewState),
              )}
            >
              <div className="relative overflow-hidden rounded-md">
                <ImageLabelReviewBadge state={reviewState} />
                <div className="aspect-square w-full overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.title ?? "Изображение"}
                    className="size-full object-contain"
                    draggable={false}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  {t("quizResult.yourAnswer")}:{" "}
                  <span className="font-medium">{assignedText}</span>
                </p>
                {!isCorrect ? (
                  <p className="text-muted-foreground">
                    {t("quizResult.puzzleCorrectAnswer")}:{" "}
                    <span className="font-medium text-foreground">{correctText}</span>
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
  const dndId = useId();
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
      id={dndId}
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
