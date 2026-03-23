"use client";

import {
  completeAttempt,
  getAttemptReviewAnswers,
  submitAnswer,
  type AttemptResult,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import {
  parseFillAssignmentsFromAnswerData,
  parseLabelPairsFromAnswerData,
  shuffleDeterministic,
} from "@/lib/quiz-helpers";
import { FillInTheBlanksContentSchema } from "@/lib/validations/fill-in-the-blanks-schema";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import type { Json } from "@/types/database.types";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  ImageLabelingQuestion,
  type ImageLabelingWord,
  buildAssignmentsFromLabelPairs,
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

function textFromContent(content: Json): string {
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    "text" in content &&
    typeof (content as { text: unknown }).text === "string"
  ) {
    return (content as { text: string }).text;
  }
  return typeof content === "string" ? content : String(content ?? "");
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
      const map = new Map<string, Record<string, string | null>>();
      const fillMap = new Map<string, Record<string, string>>();
      for (const row of res.data) {
        const pairs = parseLabelPairsFromAnswerData(row.answer_data);
        if (pairs) {
          const q = questions.find((x) => x.id === row.question_id);
          if (q?.type === "image_labeling") {
            const meta = parseImageLabelingOptions(q.options);
            const imageIds = meta.images.map((i) => i.id);
            map.set(
              row.question_id,
              buildAssignmentsFromLabelPairs(pairs, imageIds),
            );
          }
        }
        const fill = parseFillAssignmentsFromAnswerData(row.answer_data);
        if (fill) {
          const q = questions.find((x) => x.id === row.question_id);
          if (q?.type === "fill_in_the_blanks") {
            fillMap.set(row.question_id, fill);
          }
        }
      }
      if (!cancelled) {
        setReviewAnswersByQuestionId(map);
        setReviewFillByQuestionId(fillMap);
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
    const imageLabelingReviewList = questions.filter(
      (q) => q.type === "image_labeling",
    );
    const fillReviewList = questions.filter(
      (q) => q.type === "fill_in_the_blanks",
    );

    return (
      <div className="flex flex-col gap-10 py-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <Progress value={100} className="w-full max-w-md">
            <div className="flex w-full items-center gap-2">
              <ProgressLabel>Готово</ProgressLabel>
              <ProgressValue />
            </div>
          </Progress>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Результат
            </h2>
            <p className="text-muted-foreground text-lg">
              Правильных ответов:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {result.correctCount}
              </span>{" "}
              из{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {result.totalQuestions}
              </span>
            </p>
            <p className="text-muted-foreground text-sm">
              Отвечено на вопросов: {result.answeredCount} ·{" "}
              {result.percentCorrect}% верно от общего числа вопросов в тесте
            </p>
          </div>
        </div>

        {imageLabelingReviewList.length > 0 ? (
          <section className="border-border w-full rounded-xl border bg-card/30 p-4 text-left shadow-sm sm:p-6">
            <h3 className="text-foreground mb-4 text-lg font-semibold tracking-tight">
              Разбор: подписи к картинкам
            </h3>
            <div className="flex flex-col gap-10">
              {imageLabelingReviewList.map((q) => {
                const meta = parseImageLabelingOptions(q.options);
                const assignments =
                  reviewAnswersByQuestionId?.get(q.id) ??
                  Object.fromEntries(
                    meta.images.map((i) => [i.id, null] as const),
                  );
                return (
                  <div key={q.id} className="flex flex-col gap-4">
                    <h4 className="text-foreground text-base font-medium leading-snug">
                      {textFromContent(q.content)}
                    </h4>
                    <ImageLabelingQuestion
                      isReviewMode
                      images={meta.images}
                      words={meta.words}
                      assignments={assignments}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {fillReviewList.length > 0 ? (
          <section className="border-border w-full rounded-xl border bg-card/30 p-4 text-left shadow-sm sm:p-6">
            <h3 className="text-foreground mb-4 text-lg font-semibold tracking-tight">
              Разбор: заполнение пропусков
            </h3>
            <div className="flex flex-col gap-10">
              {fillReviewList.map((q) => {
                const p = FillInTheBlanksContentSchema.safeParse(q.content);
                if (!p.success) return null;
                const saved = reviewFillByQuestionId?.get(q.id) ?? {};
                return (
                  <div key={q.id} className="flex flex-col gap-4">
                    <FillInTheBlanksQuestion
                      content={p.data}
                      value={saved}
                      isReviewMode
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Progress value={progressValue} className="w-full">
        <div className="flex w-full items-center gap-2">
          <ProgressLabel>
            Вопрос {currentIndex + 1} из {total}
          </ProgressLabel>
          <ProgressValue />
        </div>
      </Progress>

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
