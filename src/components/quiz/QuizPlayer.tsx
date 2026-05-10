"use client";

import {
  completeAttempt,
  getAttemptReviewAnswers,
  submitAnswer,
  type AttemptResult,
  type SafeTestOption,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import { shuffleDeterministic } from "@/lib/quiz-helpers";
import {
  buildReviewMaps,
  type ReviewAnswerRow,
} from "@/lib/learn/build-review-maps";
import { FillInTheBlanksContentSchema } from "@/lib/validations/fill-in-the-blanks-schema";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Json } from "@/types/database.types";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  ImageLabelingQuestion,
  type ImageLabelingWord,
  imageLabelingPairsFromAssignments,
  isImageLabelingComplete,
  parseImageLabelingOptions,
} from "./ImageLabelingQuestion";
import {
  DndMatchingPuzzleQuestion,
  type DndMatchingPair,
} from "./DndMatchingPuzzleQuestion";
import {
  MatchingPuzzleQuestion,
  type MatchingPair,
} from "./MatchingPuzzleQuestion";
import { MultipleChoiceQuestion } from "./MultipleChoiceQuestion";
import { FillInTheBlanksQuestion } from "./FillInTheBlanksQuestion";
import { QuizResultView } from "./QuizResultView";

function textFromContent(content: Json): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const parts = content
      .map((node) => {
        if (!node || typeof node !== "object") return "";
        const rec = node as { text?: unknown; children?: unknown };
        if (typeof rec.text === "string") return rec.text;
        if (Array.isArray(rec.children)) {
          return rec.children
            .map((child) => {
              if (!child || typeof child !== "object") return "";
              const c = child as { text?: unknown };
              return typeof c.text === "string" ? c.text : "";
            })
            .join("");
        }
        return "";
      })
      .join("")
      .trim();
    if (parts) return parts;
    return "Вопрос";
  }

  if (content && typeof content === "object") {
    const rec = content as { text?: unknown; children?: unknown };
    if (typeof rec.text === "string") {
      return rec.text;
    }
    if (Array.isArray(rec.children)) {
      const parts = rec.children
        .map((child) => {
          if (!child || typeof child !== "object") return "";
          const c = child as { text?: unknown };
          return typeof c.text === "string" ? c.text : "";
        })
        .join("")
        .trim();
      if (parts) return parts;
    }
  }
  return "Вопрос";
}

/** Заголовок над блоком вопроса: у fill контент — JSON сегментов, не показываем как строку. */
function questionHeading(content: Json, type: string | null): string | null {
  if (type === "fill_in_the_blanks") {
    return "Заполните пропуски, перетаскивая слова из банка";
  }
  return textFromContent(content);
}

function isMultipleChoice(type: string | null | undefined): boolean {
  return type === "multiple_choice" || type === "multiple";
}

export type QuizPlayerProps = {
  attemptId: string;
  testTitle: string;
  testDescription: string | null;
  questions: SafeTestQuestion[];
};

export function QuizPlayer({
  attemptId,
  testTitle,
  testDescription,
  questions,
}: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSingleId, setSelectedSingleId] = useState<string | null>(null);
  const [selectedMultipleIds, setSelectedMultipleIds] = useState<string[]>(
    [],
  );
  const [puzzlePairs, setPuzzlePairs] = useState<
    MatchingPair[] | DndMatchingPair[]
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reviewAnswersByQuestionId, setReviewAnswersByQuestionId] = useState<
    Map<string, Record<string, string | null>> | null
  >(null);
  const [reviewFillByQuestionId, setReviewFillByQuestionId] = useState<
    Map<string, Record<string, string>> | null
  >(null);
  const [reviewRowsByQuestionId, setReviewRowsByQuestionId] = useState<
    Map<string, { option_id: string; answer_data: Json | null }[]> | null
  >(null);
  const [reviewCorrectIdsByQuestionId, setReviewCorrectIdsByQuestionId] =
    useState<Map<string, string[]> | null>(null);

  const total = questions.length;
  const current = questions[currentIndex];
  const isLast = currentIndex >= total - 1;
  const progressValue =
    total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  const multiple = current ? isMultipleChoice(current.type) : false;
  const isClickPuzzle = current?.type === "matching_puzzle";
  const isDndPuzzle = current?.type === "dnd_puzzle";
  const isAnyPairPuzzle = isClickPuzzle || isDndPuzzle;
  const isImageLabeling = current?.type === "image_labeling";
  const isFillInTheBlanks = current?.type === "fill_in_the_blanks";

  const fillBlanksMeta = useMemo(() => {
    if (!current || current.type !== "fill_in_the_blanks") return null;
    const p = FillInTheBlanksContentSchema.safeParse(current.content);
    if (!p.success) return null;
    const blankIds = p.data.segments
      .filter((s) => s.type === "blank")
      .map((s) => s.id);
    return { parsed: p.data, blankIds };
  }, [current]);

  const [fillAssignments, setFillAssignments] = useState<
    Record<string, string>
  >({});

  const imageLabelingMeta = useMemo(() => {
    if (!current || current.type !== "image_labeling") return null;
    return parseImageLabelingOptions(current.options);
  }, [current]);

  const [labelAssignments, setLabelAssignments] = useState<
    Record<string, string | null>
  >({});

  const shuffledLabelWords = useMemo(() => {
    if (!imageLabelingMeta || !current?.id) return [];
    return shuffleDeterministic<ImageLabelingWord>(
      imageLabelingMeta.words,
      current.id,
    );
  }, [current, imageLabelingMeta]);

  /** Слоты картинок с null по умолчанию + ответы пользователя (без сброса через effect). */
  const imageLabelingAssignmentsMerged = useMemo(() => {
    if (!imageLabelingMeta) {
      return {} as Record<string, string | null>;
    }
    const base = Object.fromEntries(
      imageLabelingMeta.images.map((i) => [i.id, null] as const),
    );
    return { ...base, ...labelAssignments };
  }, [imageLabelingMeta, labelAssignments]);

  useEffect(() => {
    if (!finished || !attemptId) return;
    let cancelled = false;
    void (async () => {
      const res = await getAttemptReviewAnswers(attemptId);
      if (cancelled || !res.success) return;
      const built = buildReviewMaps(res.data as ReviewAnswerRow[], questions);
      if (!cancelled) {
        setReviewAnswersByQuestionId(built.reviewAnswersByQuestionId);
        setReviewFillByQuestionId(built.reviewFillByQuestionId);
        setReviewRowsByQuestionId(built.reviewRowsByQuestionId);
        setReviewCorrectIdsByQuestionId(built.reviewCorrectIdsByQuestionId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finished, attemptId, questions]);

  function toggleMultiple(id: string) {
    setSelectedMultipleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const optionCount = current?.options.length ?? 0;
  const canSubmit = isAnyPairPuzzle
    ? optionCount > 0 && puzzlePairs.length === optionCount
    : isImageLabeling
      ? !!imageLabelingMeta &&
        imageLabelingMeta.images.length > 0 &&
        isImageLabelingComplete(
          imageLabelingAssignmentsMerged,
          imageLabelingMeta.images.map((i) => i.id),
        )
      : isFillInTheBlanks
        ? !!fillBlanksMeta &&
          fillBlanksMeta.blankIds.length > 0 &&
          fillBlanksMeta.blankIds.every((id) => Boolean(fillAssignments[id]))
        : multiple
          ? selectedMultipleIds.length >= 1
          : selectedSingleId !== null;

  function runSubmitThenAdvance() {
    if (!current || !canSubmit) return;

    setActionError(null);
    startTransition(async () => {
      const sub = isClickPuzzle
        ? await submitAnswer(attemptId, current.id, undefined, {
            matchingPairs: puzzlePairs as MatchingPair[],
          })
        : isDndPuzzle
          ? await submitAnswer(attemptId, current.id, undefined, {
              pairs: puzzlePairs as DndMatchingPair[],
            })
          : isImageLabeling && imageLabelingMeta
            ? await submitAnswer(attemptId, current.id, undefined, {
                labelPairs: imageLabelingPairsFromAssignments(
                  imageLabelingAssignmentsMerged,
                  imageLabelingMeta.images.map((i) => i.id),
                ),
              })
            : isFillInTheBlanks
              ? await submitAnswer(attemptId, current.id, undefined, {
                  fillAssignments,
                })
              : await submitAnswer(
                  attemptId,
                  current.id,
                  multiple ? selectedMultipleIds : selectedSingleId!,
                );
      if (!sub.success) {
        setActionError(sub.error);
        return;
      }

      if (!isLast) {
        setSelectedSingleId(null);
        setSelectedMultipleIds([]);
        setPuzzlePairs([]);
        setLabelAssignments({});
        setFillAssignments({});
        setCurrentIndex((i) => i + 1);
        return;
      }

      const done = await completeAttempt(attemptId);
      if (!done.success) {
        setActionError(done.error);
        return;
      }

      setResult(done.data);
      setFinished(true);
    });
  }

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        В этом тесте пока нет вопросов.
      </p>
    );
  }

  if (finished && result) {
    return (
      <QuizResultView
        questions={questions}
        result={result}
        reviewRowsByQuestionId={reviewRowsByQuestionId}
        reviewCorrectIdsByQuestionId={reviewCorrectIdsByQuestionId}
        reviewFillByQuestionId={reviewFillByQuestionId}
        reviewAnswersByQuestionId={reviewAnswersByQuestionId}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center gap-2 text-sm">
          <span>
            Вопрос {currentIndex + 1} из {total}
          </span>
          <span className="text-muted-foreground ml-auto tabular-nums">
            {progressValue}%
          </span>
        </div>
        <Progress value={progressValue} className="w-full" />
      </div>

      <header className="space-y-1">
        <p className="text-muted-foreground text-sm">{testTitle}</p>
        {testDescription ? (
          <p className="text-muted-foreground text-xs">{testDescription}</p>
        ) : null}
      </header>

      <div
        key={currentIndex}
        className="flex flex-col gap-6 transition-opacity duration-300 ease-out"
      >
        <h2 className="text-foreground text-2xl leading-snug font-semibold tracking-tight md:text-3xl">
          {current ? questionHeading(current.content, current.type) : null}
        </h2>

        {current && isClickPuzzle ? (
          <MatchingPuzzleQuestion
            key={current.id}
            options={current.options}
            pairs={puzzlePairs as MatchingPair[]}
            onPairsChange={setPuzzlePairs}
          />
        ) : current && isDndPuzzle ? (
          <DndMatchingPuzzleQuestion
            key={current.id}
            options={current.options}
            pairs={puzzlePairs as DndMatchingPair[]}
            onPairsChange={setPuzzlePairs}
          />
        ) : current && isImageLabeling ? (
          <ImageLabelingQuestion
            key={current.id}
            images={imageLabelingMeta?.images ?? []}
            words={shuffledLabelWords}
            assignments={imageLabelingAssignmentsMerged}
            onAssignmentsChange={setLabelAssignments}
          />
        ) : current && isFillInTheBlanks ? (
          fillBlanksMeta ? (
            <FillInTheBlanksQuestion
              key={current.id}
              content={fillBlanksMeta.parsed}
              value={fillAssignments}
              onChange={setFillAssignments}
            />
          ) : (
            <p className="text-destructive text-sm" role="alert">
              Не удалось загрузить вопрос с пропусками.
            </p>
          )
        ) : current && multiple ? (
          <MultipleChoiceQuestion
            options={current.options}
            selectedIds={selectedMultipleIds}
            onToggle={toggleMultiple}
          />
        ) : current ? (
          <div className="flex flex-col gap-3" role="radiogroup">
            {current.options.map((opt) => {
              const active = selectedSingleId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedSingleId(opt.id)}
                  className={
                    "border-input hover:bg-muted/60 focus-visible:ring-ring flex min-h-11 w-full items-center rounded-xl border px-4 py-3 text-left text-base transition-colors focus-visible:ring-2 focus-visible:outline-none md:min-h-12 md:text-lg " +
                    (active
                      ? "border-primary bg-primary/10 ring-primary/20 ring-2"
                      : "bg-card")
                  }
                >
                  {textFromContent(opt.content)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="min-h-11 w-full sm:w-auto md:min-h-12"
        disabled={!canSubmit || isPending}
        onClick={runSubmitThenAdvance}
      >
        {isPending
          ? "Отправка…"
          : isLast
            ? "Завершить тест"
            : "Ответить"}
      </Button>
    </div>
  );
}
