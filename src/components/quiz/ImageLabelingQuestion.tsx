"use client";

import type { SafeTestOption } from "@/app/actions/test-actions";
import { cn } from "@/lib/utils";
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
import { useMemo, useState } from "react";

const WORD_PREFIX = "imglbl-word-";
const IMAGE_PREFIX = "imglbl-img-";

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
  /** В режиме просмотра после теста не передаётся. */
  onAssignmentsChange?: (next: Record<string, string | null>) => void;
  /** Только завершённый тест: без DnD, с подсветкой верных/неверных ответов. */
  isReviewMode?: boolean;
};

/** Восстанавливает map слот картинки → id выбранного слова из сохранённых `labelPairs`. */
export function buildAssignmentsFromLabelPairs(
  labelPairs: { imageId: string; wordId: string }[] | null,
  imageIds: string[],
): Record<string, string | null> {
  const map = new Map(
    (labelPairs ?? []).map((p) => [p.imageId, p.wordId] as const),
  );
  return Object.fromEntries(
    imageIds.map((id) => [id, map.get(id) ?? null] as const),
  );
}

/** Пары «одна строка БД»: у каждой картинки есть слово с тем же option id. */
function isPairStyleLabeling(
  images: ImageLabelingImage[],
  words: ImageLabelingWord[],
): boolean {
  if (images.length === 0) return false;
  return images.every((img) => words.some((w) => w.id === img.id));
}

/** Плашка на картинке после теста: зелёный / красный / пропуск. */
function ImageLabelingReviewSlot({
  imageId,
  assignedWordId,
  wordById,
  pairStyle,
}: {
  imageId: string;
  assignedWordId: string | null;
  wordById: Map<string, ImageLabelingWord>;
  pairStyle: boolean;
}) {
  const correctWordText = wordById.get(imageId)?.text ?? "";
  const isEmpty = assignedWordId == null || assignedWordId === "";

  const userWordText = !isEmpty
    ? (wordById.get(assignedWordId)?.text ?? "—")
    : null;

  const isCorrect =
    pairStyle && !isEmpty && assignedWordId === imageId;

  if (isEmpty) {
    return (
      <div className="absolute bottom-2 left-1/2 z-10 flex w-[max(100%-1rem,8rem)] -translate-x-1/2 flex-col items-center gap-1 px-1">
        <div className="w-full rounded-md border border-amber-600/55 bg-orange-50/95 px-3 py-2 text-center shadow-sm">
          <span className="mb-0.5 block text-xs font-medium text-stone-600">
            Пропущено
          </span>
          {pairStyle && correctWordText ? (
            <span className="text-sm font-semibold text-green-700">
              {correctWordText}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Нет ответа</span>
          )}
        </div>
      </div>
    );
  }

  if (!pairStyle) {
    return (
      <div className="absolute bottom-2 left-1/2 z-10 w-[max(100%-1rem,8rem)] -translate-x-1/2 px-1">
        <div className="rounded-md border border-border bg-muted/80 px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm">
          {userWordText}
        </div>
        <p className="text-muted-foreground mt-1 text-center text-[10px] leading-tight">
          Разбор по цвету доступен для вопросов в формате «пара в одной строке».
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-1/2 z-10 flex w-[max(100%-1rem,8rem)] -translate-x-1/2 flex-col items-center gap-1 px-1">
      <div
        className={cn(
          "w-full rounded-md border px-3 py-2 text-center text-sm font-medium shadow-sm",
          isCorrect
            ? "border-green-500 bg-green-100 text-green-800"
            : "border-red-500 bg-red-100 text-red-800",
        )}
      >
        {userWordText}
      </div>
      {!isCorrect ? (
        <div className="rounded bg-white/80 px-1 text-xs font-semibold text-green-600">
          Правильно: {correctWordText || "—"}
        </div>
      ) : null}
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
  const wordById = useMemo(() => {
    const m = new Map<string, ImageLabelingWord>();
    for (const w of words) m.set(w.id, w);
    return m;
  }, [words]);

  const pairStyle = useMemo(
    () => isPairStyleLabeling(images, words),
    [images, words],
  );

  if (images.length === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Нет изображений для разбора.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Разбор ответов: верно — зелёным, ошибка — красным. Проверка только после
        завершения теста.
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <li key={img.id}>
            <div className="border-border relative overflow-hidden rounded-xl border-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.title ?? ""}
                className="aspect-[4/3] h-auto w-full object-cover"
                draggable={false}
              />
              <ImageLabelingReviewSlot
                imageId={img.id}
                assignedWordId={assignments[img.id] ?? null}
                wordById={wordById}
                pairStyle={pairStyle}
              />
            </div>
            {img.title ? (
              <p className="text-muted-foreground mt-1 text-center text-xs">
                {img.title}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Пары для отправки на сервер (только при полном заполнении). */
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

/**
 * Новый формат: каждая опция — пара `imageUrl` + `correctText` (или `correctWord`).
 * Старый формат: отдельные строки только с картинкой и только со словом.
 */
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

function WordItem({
  word,
  variant,
}: {
  word: ImageLabelingWord;
  variant: "pool" | "sticker";
}) {
  const id = `${WORD_PREFIX}${word.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "cursor-grab touch-none rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing",
        variant === "sticker" &&
          "bg-card/90 shadow-md backdrop-blur-sm",
        isDragging && "opacity-40",
      )}
      {...listeners}
      {...attributes}
    >
      {word.text}
    </div>
  );
}

function ImageCard({
  image,
  assignedWord,
}: {
  image: ImageLabelingImage;
  assignedWord: ImageLabelingWord | null;
}) {
  const dropId = `${IMAGE_PREFIX}${image.id}`;
  const { setNodeRef } = useDroppable({ id: dropId });

  return (
    <div
      ref={setNodeRef}
      className="border-border relative overflow-hidden rounded-xl border-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.title ?? ""}
        className="aspect-[4/3] h-auto w-full object-cover"
        draggable={false}
      />
      {assignedWord ? (
        <div className="absolute bottom-2 left-1/2 z-10 w-[max(100%-1rem,8rem)] -translate-x-1/2 px-1">
          <WordItem word={assignedWord} variant="sticker" />
        </div>
      ) : null}
    </div>
  );
}

function ImageLabelingPlayView({
  images,
  words,
  assignments,
  onAssignmentsChange,
}: Omit<ImageLabelingQuestionProps, "isReviewMode">) {
  if (!onAssignmentsChange) {
    throw new Error(
      "ImageLabelingQuestion: передайте onAssignmentsChange, если isReviewMode не задан",
    );
  }

  const patchAssignments = onAssignmentsChange;

  const [activeWordId, setActiveWordId] = useState<string | null>(null);

  const wordById = useMemo(() => {
    const m = new Map<string, ImageLabelingWord>();
    for (const w of words) m.set(w.id, w);
    return m;
  }, [words]);

  const assignedWordIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as string[]),
    [assignments],
  );

  const poolWords = useMemo(
    () => words.filter((w) => !assignedWordIds.has(w.id)),
    [words, assignedWordIds],
  );

  const activeWord = activeWordId ? wordById.get(activeWordId) : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const raw = String(event.active.id);
    if (!raw.startsWith(WORD_PREFIX)) return;
    setActiveWordId(raw.slice(WORD_PREFIX.length));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveWordId(null);

    const aid = String(active.id);
    if (!aid.startsWith(WORD_PREFIX)) return;
    const wordId = aid.slice(WORD_PREFIX.length);

    const clearWordFromAssignments = (
      prev: Record<string, string | null>,
    ): Record<string, string | null> => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === wordId) next[key] = null;
      }
      return next;
    };

    if (over) {
      const oid = String(over.id);
      if (oid.startsWith(IMAGE_PREFIX)) {
        const imageId = oid.slice(IMAGE_PREFIX.length);
        let next = clearWordFromAssignments(assignments);
        next = { ...next, [imageId]: wordId };
        patchAssignments(next);
        return;
      }
    }

    patchAssignments(clearWordFromAssignments(assignments));
  }

  if (images.length === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Нет изображений для подписи (ожидаются варианты с{" "}
        <code className="text-foreground text-xs">imageUrl</code> в контенте).
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-10">
        <div>
          <p className="text-muted-foreground mb-3 text-sm">
            Перетащите слово на картинку. Проверка будет после отправки ответа.
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => {
              const wid = assignments[img.id];
              const assignedWord =
                wid != null ? wordById.get(wid) ?? null : null;
              return (
                <li key={img.id}>
                  <ImageCard image={img} assignedWord={assignedWord} />
                  {img.title ? (
                    <p className="text-muted-foreground mt-1 text-center text-xs">
                      {img.title}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-border rounded-xl border border-dashed bg-muted/20 p-4">
          <p className="text-muted-foreground mb-3 text-sm font-medium">
            Банк слов
          </p>
          {poolWords.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Все слова размещены на картинках.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {poolWords.map((w) => (
                <WordItem key={w.id} word={w} variant="pool" />
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWord ? (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-lg">
            {activeWord.text}
          </div>
        ) : null}
      </DragOverlay>
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

  return (
    <ImageLabelingPlayView
      images={images}
      words={words}
      assignments={assignments}
      onAssignmentsChange={onAssignmentsChange}
    />
  );
}
