"use client";

import {
  completeAttempt,
  getAttemptReviewAnswers,
  submitAnswer,
  type AttemptResult,
  type SafeTestOption,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import {
  parseFillAssignmentsFromAnswerData,
  parseLabelPairsFromAnswerData,
  shuffleDeterministic,
} from "@/lib/quiz-helpers";
import { FillInTheBlanksContentSchema } from "@/lib/validations/fill-in-the-blanks-schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

function parsePairsFromAnswerData(
  answerData: Json | null,
): { leftOptionId: string; rightOptionId: string }[] {
  if (!answerData || typeof answerData !== "object" || Array.isArray(answerData)) {
    return [];
  }
  const raw =
    (answerData as { pairs?: unknown }).pairs ??
    (answerData as { matchingPairs?: unknown }).matchingPairs;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is { leftOptionId: string; rightOptionId: string } =>
      typeof p === "object" &&
      p !== null &&
      !Array.isArray(p) &&
      typeof (p as { leftOptionId?: unknown }).leftOptionId === "string" &&
      typeof (p as { rightOptionId?: unknown }).rightOptionId === "string",
  );
}

function puzzlePartText(content: Json, side: "left" | "right"): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { left?: unknown; right?: unknown })[side];
    if (typeof v === "string") return v;
  }
  return "—";
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
      const map = new Map<string, Record<string, string | null>>();
      const fillMap = new Map<string, Record<string, string>>();
      const rowsMap = new Map<
        string,
        { option_id: string; answer_data: Json | null }[]
      >();
      const correctIdsMap = new Map<string, string[]>();
      for (const row of res.data) {
        const list = rowsMap.get(row.question_id) ?? [];
        list.push({ option_id: row.option_id, answer_data: row.answer_data });
        rowsMap.set(row.question_id, list);
        correctIdsMap.set(row.question_id, row.correct_option_ids);

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
        setReviewRowsByQuestionId(rowsMap);
        setReviewCorrectIdsByQuestionId(correctIdsMap);
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
    const getSelectedIdsForQuestion = (questionId: string) => {
      const rows = reviewRowsByQuestionId?.get(questionId) ?? [];
      const selectedIdsFromData =
        rows.length > 0 &&
        rows[0]?.answer_data &&
        typeof rows[0].answer_data === "object" &&
        !Array.isArray(rows[0].answer_data) &&
        Array.isArray(
          (rows[0].answer_data as { selectedOptionIds?: unknown }).selectedOptionIds,
        )
          ? (
              (rows[0].answer_data as { selectedOptionIds: unknown[] })
                .selectedOptionIds
            ).filter((x): x is string => typeof x === "string")
          : [];
      return selectedIdsFromData.length > 0
        ? selectedIdsFromData
        : rows.map((r) => r.option_id);
    };

    const isQuestionFullyCorrect = (q: SafeTestQuestion): boolean => {
      const rows = reviewRowsByQuestionId?.get(q.id) ?? [];
      const answerData = rows[0]?.answer_data ?? null;

      if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
        const pairs = parsePairsFromAnswerData(answerData);
        if (pairs.length !== q.options.length) return false;
        return q.options.every((leftOpt) =>
          pairs.some(
            (p) => p.leftOptionId === leftOpt.id && p.rightOptionId === leftOpt.id,
          ),
        );
      }

      if (q.type === "single_choice" || q.type === "multiple_choice" || q.type === "multiple") {
        const selected = [...new Set(getSelectedIdsForQuestion(q.id))].sort();
        const correct = [...new Set(reviewCorrectIdsByQuestionId?.get(q.id) ?? [])].sort();
        if (selected.length !== correct.length) return false;
        return selected.every((id, i) => id === correct[i]);
      }

      if (q.type === "fill_in_the_blanks") {
        const p = FillInTheBlanksContentSchema.safeParse(q.content);
        if (!p.success) return false;
        const saved = reviewFillByQuestionId?.get(q.id) ?? {};
        const blankIds = Object.keys(p.data.correctMapping);
        if (Object.keys(saved).length !== blankIds.length) return false;
        return blankIds.every((id) => saved[id] === p.data.correctMapping[id]);
      }

      if (q.type === "image_labeling") {
        const meta = parseImageLabelingOptions(q.options);
        const assignments = reviewAnswersByQuestionId?.get(q.id) ?? {};
        return (
          meta.images.length > 0 &&
          meta.images.every((img) => assignments[img.id] !== null && assignments[img.id] === img.id)
        );
      }

      return false;
    };

    const totalCorrectQuestions = questions.filter((q) =>
      isQuestionFullyCorrect(q),
    ).length;

    return (
      <div className="flex flex-col gap-10 py-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex w-full max-w-md flex-col gap-2">
            <div className="flex w-full items-center gap-2 text-sm">
              <span className="font-medium">Готово</span>
              <span className="text-muted-foreground ml-auto tabular-nums">
                100%
              </span>
            </div>
            <Progress value={100} className="w-full" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Результат
            </h2>
            <p className="text-muted-foreground text-lg">
              Правильных ответов:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {totalCorrectQuestions}
              </span>{" "}
              из{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {questions.length}
              </span>
            </p>
            <p className="text-muted-foreground text-sm">
              Отвечено на вопросов: {result.answeredCount} ·{" "}
              {result.percentCorrect}% верно от общего числа вопросов в тесте
            </p>
          </div>
        </div>

        <section className="border-border w-full rounded-xl border bg-card/30 p-4 text-left shadow-sm sm:p-6">
          <h3 className="text-foreground mb-4 text-lg font-semibold tracking-tight">
            Разбор ответов
          </h3>
          <div className="flex flex-col gap-10">
            {questions.map((q, index) => {
              const rows = reviewRowsByQuestionId?.get(q.id) ?? [];
              const answerData = rows[0]?.answer_data ?? null;
              const questionFullyCorrect = isQuestionFullyCorrect(q);

              const selectedIdsFromData =
                rows.length > 0 &&
                rows[0]?.answer_data &&
                typeof rows[0].answer_data === "object" &&
                !Array.isArray(rows[0].answer_data) &&
                Array.isArray(
                  (rows[0].answer_data as { selectedOptionIds?: unknown })
                    .selectedOptionIds,
                )
                  ? (
                      (rows[0].answer_data as { selectedOptionIds: unknown[] })
                        .selectedOptionIds
                    ).filter((x): x is string => typeof x === "string")
                  : [];
              const selectedIds =
                selectedIdsFromData.length > 0
                  ? selectedIdsFromData
                  : rows.map((r) => r.option_id);

              return (
                <div
                  key={q.id}
                  className="mb-6 space-y-4 rounded-xl border p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-foreground text-base font-medium leading-snug">
                      Вопрос {index + 1}: {textFromContent(q.content)}
                    </h4>
                    <Badge
                      variant={questionFullyCorrect ? "secondary" : "destructive"}
                      className={
                        questionFullyCorrect
                          ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : undefined
                      }
                    >
                      {questionFullyCorrect ? "Верно" : "Ошибка"}
                    </Badge>
                  </div>

                  {(q.type === "matching_puzzle" || q.type === "dnd_puzzle") && (() => {
                    const pairs = parsePairsFromAnswerData(answerData);
                    const optionById = new Map(q.options.map((o) => [o.id, o]));
                    return (
                      <div className="flex flex-col gap-2">
                        {q.options.map((leftOpt) => {
                          const pair = pairs.find((p) => p.leftOptionId === leftOpt.id);
                          const userRight = pair
                            ? optionById.get(pair.rightOptionId)
                            : undefined;
                          const correctRight = optionById.get(leftOpt.id);
                          const isCorrect = Boolean(
                            pair && pair.rightOptionId === leftOpt.id,
                          );
                          return (
                            <div
                              key={`${q.id}-${leftOpt.id}`}
                              className="rounded-md border bg-muted/50 p-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {puzzlePartText(leftOpt.content, "left")}
                                </span>
                                <span className="text-muted-foreground">—</span>
                                <span>
                                  {userRight
                                    ? puzzlePartText(userRight.content, "right")
                                    : "— Нет ответа —"}
                                </span>
                                <Badge
                                  variant={isCorrect ? "secondary" : "destructive"}
                                  className={
                                    isCorrect
                                      ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : undefined
                                  }
                                >
                                  {isCorrect ? "Верно" : "Ошибка"}
                                </Badge>
                              </div>
                              {!isCorrect && correctRight ? (
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Правильно: {puzzlePartText(correctRight.content, "right")}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {(q.type === "single_choice" ||
                    q.type === "multiple_choice" ||
                    q.type === "multiple") && (() => {
                    const correctIds = reviewCorrectIdsByQuestionId?.get(q.id) ?? [];
                    const selectedOptions = selectedIds
                      .map((id) => q.options.find((o) => o.id === id))
                      .filter((o): o is SafeTestOption => Boolean(o));
                    const missedCorrectIds = correctIds.filter(
                      (id) => !selectedIds.includes(id),
                    );
                    return (
                      <div className="flex flex-col gap-2">
                        {selectedOptions.length > 0 ? (
                          selectedOptions.map((opt) => {
                            const isCorrect = correctIds.includes(opt.id);
                            return (
                              <div
                                key={`${q.id}-${opt.id}`}
                                className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm"
                              >
                                <span>{textFromContent(opt.content)}</span>
                                <Badge
                                  variant={isCorrect ? "secondary" : "destructive"}
                                  className={
                                    isCorrect
                                      ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : undefined
                                  }
                                >
                                  {isCorrect ? "Верно" : "Ошибка"}
                                </Badge>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground text-sm">— Нет ответа —</p>
                        )}
                        {missedCorrectIds.length > 0 ? (
                          <p className="text-muted-foreground text-xs">
                            Правильный ответ:{" "}
                            {missedCorrectIds
                              .map((id) => q.options.find((o) => o.id === id))
                              .filter((o): o is SafeTestOption => Boolean(o))
                              .map((o) => textFromContent(o.content))
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}

                  {q.type === "image_labeling" && (() => {
                    const meta = parseImageLabelingOptions(q.options);
                    const assignments =
                      reviewAnswersByQuestionId?.get(q.id) ??
                      Object.fromEntries(
                        meta.images.map((i) => [i.id, null] as const),
                      );
                    return (
                      <ImageLabelingQuestion
                        isReviewMode
                        images={meta.images}
                        words={meta.words}
                        assignments={assignments}
                      />
                    );
                  })()}

                  {q.type === "fill_in_the_blanks" && (() => {
                    const p = FillInTheBlanksContentSchema.safeParse(q.content);
                    if (!p.success) {
                      return (
                        <p className="text-muted-foreground text-sm">
                          Не удалось показать разбор этого вопроса.
                        </p>
                      );
                    }
                    const saved = reviewFillByQuestionId?.get(q.id) ?? {};
                    return (
                      <FillInTheBlanksQuestion
                        content={p.data}
                        value={saved}
                        isReviewMode
                      />
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </section>
      </div>
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
