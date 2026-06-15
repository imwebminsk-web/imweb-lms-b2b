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
  isGroupedFillAssignmentsComplete,
  isGroupedFillBlanksSelectionComplete,
  resolveGroupedFillBlanksPlayerView,
} from "@/lib/grouped-fill-blanks-utils";
import { resolveGroupedChoicePlayerView, LEGACY_GROUPED_ITEM_ID } from "@/lib/grouped-choice-utils";
import { resolveOrderingPlayerView } from "@/lib/ordering-utils";
import {
  buildReviewMaps,
  type ReviewAnswerRow,
} from "@/lib/learn/build-review-maps";
import { parseTaskPresentation } from "@/lib/utils/task-content";
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
import {
  GroupedChoiceTaskQuestion,
  isGroupedChoiceSelectionComplete,
} from "./GroupedChoiceTaskQuestion";
import { GroupedFillBlanksTaskQuestion } from "./GroupedFillBlanksTaskQuestion";
import {
  OrderingTaskQuestion,
  isOrderingSelectionComplete,
} from "./OrderingTaskQuestion";
import { QuizResultView } from "./QuizResultView";
import { QuizTaskInstruction } from "./QuizTaskInstruction";

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

const FILL_IN_THE_BLANKS_FALLBACK_HEADING =
  "Заполните пропуски, перетаскивая слова из банка";

const FILL_BLANKS_TYPING_FALLBACK_HEADING =
  "Заполните пропуски, вводя слова вручную";
const TEXT_INPUT_FALLBACK_HEADING = "Развёрнутый ответ";

function readOptionalStringField(content: Json, key: string): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const value = (content as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fillInTheBlanksInstructionText(content: Json): string | null {
  return readOptionalStringField(content, "text");
}

function isMultipleChoice(type: string | null | undefined): boolean {
  return type === "multiple_choice" || type === "multiple";
}

function isChoiceQuestionType(type: string | null | undefined): boolean {
  return type === "single_choice" || type === "multiple_choice" || type === "multiple";
}

export type QuizPlayerProps = {
  attemptId: string;
  testTitle: string;
  testDescription: string | null;
  questions: SafeTestQuestion[];
  isForKids?: boolean;
};

export function QuizPlayer({
  attemptId,
  testTitle,
  testDescription,
  questions,
  isForKids = false,
}: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
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

  const [reviewGroupedSelectionsByQuestionId, setReviewGroupedSelectionsByQuestionId] =
    useState<Map<string, Record<string, string[]>> | null>(null);
  const [reviewGroupedCorrectByQuestionId, setReviewGroupedCorrectByQuestionId] =
    useState<Map<string, Record<string, string[]>> | null>(null);
  const [reviewGroupedFillTypingByQuestionId, setReviewGroupedFillTypingByQuestionId] =
    useState<Map<string, Record<string, Record<string, string>>> | null>(null);
  const [reviewGroupedFillAssignmentsByQuestionId, setReviewGroupedFillAssignmentsByQuestionId] =
    useState<Map<string, Record<string, Record<string, string>>> | null>(null);
  const [reviewOrderingAssignmentsByQuestionId, setReviewOrderingAssignmentsByQuestionId] =
    useState<Map<string, Record<string, string[]>> | null>(null);

  const total = questions.length;
  const current = questions[currentIndex];
  const isLast = currentIndex >= total - 1;
  const progressValue =
    total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  const multiple = current ? isMultipleChoice(current.type) : false;
  const isChoiceQuestion = current ? isChoiceQuestionType(current.type) : false;
  const isClickPuzzle = current?.type === "matching_puzzle";
  const isDndPuzzle = current?.type === "dnd_puzzle";
  const isAnyPairPuzzle = isClickPuzzle || isDndPuzzle;
  const isImageLabeling = current?.type === "image_labeling";
  const isFillInTheBlanks =
    current?.type === "fill_in_the_blanks" ||
    current?.type === "fill_in_the_blanks_multi";
  const isFillBlanksTyping =
    current?.type === "fill_blanks_typing" ||
    current?.type === "fill_blanks_typing_multi";
  const isTextInput = current?.type === "text_input";
  const isOrdering = current?.type === "ordering";
  const isAnyGroupedFillBlanks =
    isFillInTheBlanks || isFillBlanksTyping || isTextInput;

  const taskPresentation = useMemo(() => {
    if (!current) return null;
    return parseTaskPresentation(current.content);
  }, [current]);

  const groupedFillBlanksView = useMemo(() => {
    if (!current || !isAnyGroupedFillBlanks) return null;
    return resolveGroupedFillBlanksPlayerView({
      content: current.content,
      questionType: current.type,
    });
  }, [current, isAnyGroupedFillBlanks]);

  const [groupedFillAssignments, setGroupedFillAssignments] = useState<
    Record<string, Record<string, string>>
  >({});
  const [groupedFillTyping, setGroupedFillTyping] = useState<
    Record<string, Record<string, string>>
  >({});
  const [groupedSelections, setGroupedSelections] = useState<
    Record<string, string[]>
  >({});
  const [orderingAssignments, setOrderingAssignments] = useState<
    Record<string, string[]>
  >({});

  const choicePlayerView = useMemo(() => {
    if (!current || !isChoiceQuestion) return null;
    return resolveGroupedChoicePlayerView({
      content: current.content,
      questionType: current.type,
      legacyOptions: current.options,
    });
  }, [current, isChoiceQuestion]);

  const orderingPlayerView = useMemo(() => {
    if (!current || !isOrdering) return null;
    return resolveOrderingPlayerView({
      content: current.content,
    });
  }, [current, isOrdering]);

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
      const built = buildReviewMaps(
        res.data.answers as ReviewAnswerRow[],
        questions,
        res.data.groupedCorrectByQuestionId,
      );
      if (!cancelled) {
        setReviewAnswersByQuestionId(built.reviewAnswersByQuestionId);
        setReviewFillByQuestionId(built.reviewFillByQuestionId);
        setReviewRowsByQuestionId(built.reviewRowsByQuestionId);
        setReviewCorrectIdsByQuestionId(built.reviewCorrectIdsByQuestionId);
        setReviewGroupedSelectionsByQuestionId(
          built.reviewGroupedSelectionsByQuestionId,
        );
        setReviewGroupedCorrectByQuestionId(
          built.reviewGroupedCorrectByQuestionId,
        );
        setReviewGroupedFillTypingByQuestionId(
          built.reviewGroupedFillTypingByQuestionId,
        );
        setReviewGroupedFillAssignmentsByQuestionId(
          built.reviewGroupedFillAssignmentsByQuestionId,
        );
        setReviewOrderingAssignmentsByQuestionId(
          built.reviewOrderingAssignmentsByQuestionId,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finished, attemptId, questions]);

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
      : isAnyGroupedFillBlanks && groupedFillBlanksView
        ? groupedFillBlanksView.mode === "dnd"
          ? isGroupedFillAssignmentsComplete(
              groupedFillBlanksView,
              groupedFillAssignments,
            )
          : isGroupedFillBlanksSelectionComplete(
              groupedFillBlanksView,
              groupedFillTyping,
            )
        : isChoiceQuestion && choicePlayerView
            ? isGroupedChoiceSelectionComplete(
                choicePlayerView.items,
                groupedSelections,
                multiple,
              )
          : isOrdering && orderingPlayerView
            ? isOrderingSelectionComplete(
                orderingPlayerView.items,
                orderingAssignments,
              )
          : false;

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
            : isAnyGroupedFillBlanks && groupedFillBlanksView
              ? groupedFillBlanksView.mode === "dnd"
                ? await submitAnswer(attemptId, current.id, undefined, {
                    groupedFillAssignments,
                  })
                : await submitAnswer(attemptId, current.id, undefined, {
                    groupedFillTyping,
                  })
              : isChoiceQuestion && choicePlayerView
                ? choicePlayerView.isGrouped
                  ? await submitAnswer(attemptId, current.id, undefined, {
                      groupedSelections,
                    })
                  : await submitAnswer(
                      attemptId,
                      current.id,
                      multiple
                        ? (groupedSelections[LEGACY_GROUPED_ITEM_ID] ?? [])
                        : groupedSelections[LEGACY_GROUPED_ITEM_ID]?.[0],
                    )
              : isOrdering && orderingPlayerView
                ? await submitAnswer(attemptId, current.id, undefined, {
                    orderingAssignments,
                  })
              : { success: false as const, error: "Неподдерживаемый тип задания" };
      if (!sub.success) {
        setActionError(sub.error);
        return;
      }

      if (!isLast) {
        setPuzzlePairs([]);
        setLabelAssignments({});
        setGroupedFillAssignments({});
        setGroupedFillTyping({});
        setGroupedSelections({});
        setOrderingAssignments({});
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
        reviewGroupedSelectionsByQuestionId={reviewGroupedSelectionsByQuestionId}
        reviewGroupedCorrectByQuestionId={reviewGroupedCorrectByQuestionId}
        reviewGroupedFillTypingByQuestionId={reviewGroupedFillTypingByQuestionId}
        reviewGroupedFillAssignmentsByQuestionId={
          reviewGroupedFillAssignmentsByQuestionId
        }
        reviewOrderingAssignmentsByQuestionId={
          reviewOrderingAssignmentsByQuestionId
        }
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
        {current && taskPresentation ? (
          <div className="space-y-2">
            <QuizTaskInstruction
              task={taskPresentation}
              fallbackTitle={
                isFillInTheBlanks
                  ? FILL_IN_THE_BLANKS_FALLBACK_HEADING
                  : isFillBlanksTyping
                    ? FILL_BLANKS_TYPING_FALLBACK_HEADING
                    : isTextInput
                      ? TEXT_INPUT_FALLBACK_HEADING
                    : isChoiceQuestion
                      ? choicePlayerView?.taskInstruction ?? "Вопрос"
                      : isOrdering
                        ? orderingPlayerView?.taskInstruction ?? "Вопрос"
                      : textFromContent(current.content)
              }
            />
            {isFillInTheBlanks && fillInTheBlanksInstructionText(current.content) ? (
              <p className="text-muted-foreground text-sm">
                (перетащите слова из банка)
              </p>
            ) : null}
          </div>
        ) : null}

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
        ) : current && isAnyGroupedFillBlanks && groupedFillBlanksView ? (
          <GroupedFillBlanksTaskQuestion
            key={current.id}
            items={groupedFillBlanksView.items}
            mode={groupedFillBlanksView.mode}
            groupedTyping={groupedFillTyping}
            groupedAssignments={groupedFillAssignments}
            onTypingChange={setGroupedFillTyping}
            onAssignmentsChange={setGroupedFillAssignments}
          />
        ) : current && isAnyGroupedFillBlanks ? (
          <p className="text-destructive text-sm" role="alert">
            {isTextInput
              ? "Не удалось загрузить развёрнутый ответ."
              : "Не удалось загрузить вопрос с пропусками."}
          </p>
        ) : current && isChoiceQuestion && choicePlayerView ? (
          <GroupedChoiceTaskQuestion
            key={current.id}
            items={choicePlayerView.items}
            isMultiple={multiple}
            selections={groupedSelections}
            onSelectionsChange={setGroupedSelections}
          />
        ) : current && isOrdering && orderingPlayerView ? (
          <OrderingTaskQuestion
            key={current.id}
            items={orderingPlayerView.items}
            assignments={orderingAssignments}
            onAssignmentsChange={setOrderingAssignments}
          />
        ) : current && isOrdering ? (
          <p className="text-destructive text-sm" role="alert">
            Не удалось загрузить задание с упорядочиванием.
          </p>
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
