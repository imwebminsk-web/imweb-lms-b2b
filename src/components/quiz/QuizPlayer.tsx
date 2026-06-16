"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  completeAttempt,
  getAttemptReviewAnswers,
  type AttemptResult,
  type SafeTestQuestion,
} from "@/app/actions/test-actions";
import { shuffleDeterministic } from "@/lib/quiz-helpers";
import { resolveGroupedFillBlanksPlayerView } from "@/lib/grouped-fill-blanks-utils";
import { resolveGroupedChoicePlayerView } from "@/lib/grouped-choice-utils";
import { resolveOrderingPlayerView } from "@/lib/ordering-utils";
import {
  buildReviewMaps,
  type ReviewAnswerRow,
} from "@/lib/learn/build-review-maps";
import { parseTaskPresentation } from "@/lib/utils/task-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  ImageLabelingQuestion,
  type ImageLabelingWord,
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
import { GroupedChoiceTaskQuestion } from "./GroupedChoiceTaskQuestion";
import { GroupedFillBlanksTaskQuestion } from "./GroupedFillBlanksTaskQuestion";
import { OrderingTaskQuestion } from "./OrderingTaskQuestion";
import {
  canSubmitQuestionDraft,
  emptyQuestionDraft,
  submitQuestionDraft,
  type QuestionDraft,
} from "./quiz-player-draft";
import { QuizResultView } from "./QuizResultView";
import { QuizTaskInstruction } from "./QuizTaskInstruction";
import { QuizTimer } from "./QuizTimer";

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
  /** Лимит времени в минутах; 0 — без ограничения. */
  timeLimitMinutes?: number;
};

export function QuizPlayer({
  attemptId,
  testTitle,
  testDescription,
  questions,
  isForKids = false,
  timeLimitMinutes = 0,
}: QuizPlayerProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftsByQuestionId, setDraftsByQuestionId] = useState<
    Record<string, QuestionDraft>
  >({});
  const [submittedQuestionIds, setSubmittedQuestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const finishingRef = useRef(false);
  const draftsRef = useRef(draftsByQuestionId);
  const submittedRef = useRef(submittedQuestionIds);

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
  const [cheatWarnings, setCheatWarnings] = useState(0);

  const cheatWarningsRef = useRef(0);
  const handleSubmitQuizRef = useRef<() => void>(() => {});

  draftsRef.current = draftsByQuestionId;
  submittedRef.current = submittedQuestionIds;

  const total = questions.length;
  const current = questions[currentIndex];
  const isLast = currentIndex >= total - 1;
  const progressValue =
    total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  const currentDraft = useMemo(
    () =>
      current
        ? (draftsByQuestionId[current.id] ?? emptyQuestionDraft())
        : emptyQuestionDraft(),
    [current, draftsByQuestionId],
  );

  const isCurrentSubmitted = current
    ? submittedQuestionIds.has(current.id)
    : false;
  const inputsLocked = isCurrentSubmitted || isPending || finished;

  const multiple = current ? isMultipleChoice(current.type) : false;
  const isChoiceQuestion = current ? isChoiceQuestionType(current.type) : false;
  const isClickPuzzle = current?.type === "matching_puzzle";
  const isDndPuzzle = current?.type === "dnd_puzzle";
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

  const shuffledLabelWords = useMemo(() => {
    if (!imageLabelingMeta || !current?.id) return [];
    return shuffleDeterministic<ImageLabelingWord>(
      imageLabelingMeta.words,
      current.id,
    );
  }, [current, imageLabelingMeta]);

  const imageLabelingAssignmentsMerged = useMemo(() => {
    if (!imageLabelingMeta) {
      return {} as Record<string, string | null>;
    }
    const base = Object.fromEntries(
      imageLabelingMeta.images.map((i) => [i.id, null] as const),
    );
    return { ...base, ...currentDraft.labelAssignments };
  }, [imageLabelingMeta, currentDraft.labelAssignments]);

  const patchCurrentDraft = useCallback(
    (patch: Partial<QuestionDraft>) => {
      if (!current) return;
      setDraftsByQuestionId((prev) => ({
        ...prev,
        [current.id]: {
          ...(prev[current.id] ?? emptyQuestionDraft()),
          ...patch,
        },
      }));
    },
    [current],
  );

  const canSubmit = current
    ? canSubmitQuestionDraft(current, currentDraft)
    : false;

  const finalizeQuiz = useCallback(() => {
    if (finishingRef.current || finished) return;
    finishingRef.current = true;
    setActionError(null);

    startTransition(async () => {
      const drafts = draftsRef.current;
      const submitted = submittedRef.current;

      for (const q of questions) {
        if (submitted.has(q.id)) continue;
        const draft = drafts[q.id] ?? emptyQuestionDraft();
        if (!canSubmitQuestionDraft(q, draft)) continue;

        const sub = await submitQuestionDraft(attemptId, q, draft);
        if (!sub.success) {
          setActionError(sub.error);
          finishingRef.current = false;
          return;
        }
        setSubmittedQuestionIds((prev) => new Set(prev).add(q.id));
      }

      const done = await completeAttempt(attemptId);
      if (!done.success) {
        setActionError(done.error);
        finishingRef.current = false;
        return;
      }

      setResult(done.data);
      setFinished(true);
    });
  }, [attemptId, finished, questions]);

  const handleSubmitQuiz = useCallback(() => {
    if (isPending || finished || finishingRef.current) return;
    finalizeQuiz();
  }, [finalizeQuiz, finished, isPending]);

  handleSubmitQuizRef.current = handleSubmitQuiz;

  useEffect(() => {
    if (finished) return;

    const preventClipboardAndContextMenu = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("contextmenu", preventClipboardAndContextMenu);
    window.addEventListener("copy", preventClipboardAndContextMenu);
    window.addEventListener("paste", preventClipboardAndContextMenu);

    return () => {
      window.removeEventListener("contextmenu", preventClipboardAndContextMenu);
      window.removeEventListener("copy", preventClipboardAndContextMenu);
      window.removeEventListener("paste", preventClipboardAndContextMenu);
    };
  }, [finished]);

  useEffect(() => {
    if (finished) return;

    function handleTabHidden() {
      if (!document.hidden) return;
      if (finishingRef.current) return;

      const next = cheatWarningsRef.current + 1;
      cheatWarningsRef.current = next;
      setCheatWarnings(next);

      if (next === 1) {
        toast.warning(t("quiz.cheatWarningFirst"), { duration: 8000 });
        return;
      }

      if (next >= 2) {
        toast.error(t("quiz.cheatAutoSubmit"), { duration: 10000 });
        handleSubmitQuizRef.current();
      }
    }

    document.addEventListener("visibilitychange", handleTabHidden);

    return () => {
      document.removeEventListener("visibilitychange", handleTabHidden);
    };
  }, [finished, t]);

  function goToTask(index: number) {
    if (index < 0 || index >= total || index === currentIndex) return;
    setCurrentIndex(index);
  }

  function runSubmitThenAdvance() {
    if (!current || !canSubmit || isCurrentSubmitted) return;

    setActionError(null);
    startTransition(async () => {
      const sub = await submitQuestionDraft(attemptId, current, currentDraft);
      if (!sub.success) {
        setActionError(sub.error);
        return;
      }

      setSubmittedQuestionIds((prev) => new Set(prev).add(current.id));

      if (!isLast) {
        setCurrentIndex((i) => i + 1);
        return;
      }

      const done = await completeAttempt(attemptId);
      if (!done.success) {
        setActionError(done.error);
        return;
      }

      finishingRef.current = true;
      setResult(done.data);
      setFinished(true);
    });
  }

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

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        {t("quiz.noQuestions")}
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
    <div
      className={cn(
        "flex flex-col gap-8 select-none",
        "[&_input]:cursor-text [&_input]:select-text",
        "[&_textarea]:cursor-text [&_textarea]:select-text",
      )}
      data-cheat-warnings={cheatWarnings > 0 ? cheatWarnings : undefined}
    >
      <QuizTimer
        timeLimitMinutes={timeLimitMinutes}
        onExpire={handleSubmitQuiz}
        disabled={isPending || finished}
        timeRemainingLabel={t("quiz.timeRemaining")}
      />

      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center gap-2 text-sm">
          <span>
            {t("quiz.task")} {currentIndex + 1} {t("quiz.of")} {total}
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

      <nav
        className="flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-muted/30 p-2 sm:p-3"
        aria-label={t("quiz.taskNav")}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={currentIndex === 0 || isPending}
          onClick={() => goToTask(currentIndex - 1)}
          aria-label={t("quiz.prevTask")}
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
        </Button>

        <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
          {questions.map((q, index) => {
            const isActive = index === currentIndex;
            const isSubmitted = submittedQuestionIds.has(q.id);
            return (
              <Button
                key={q.id}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "min-w-9 px-2 tabular-nums",
                  isSubmitted && !isActive && "border-emerald-500/40",
                )}
                onClick={() => goToTask(index)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${t("quiz.task")} ${index + 1}${isSubmitted ? t("quiz.answerSentAria") : ""}`}
                disabled={isPending}
              >
                {index + 1}
              </Button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={currentIndex >= total - 1 || isPending}
          onClick={() => goToTask(currentIndex + 1)}
          aria-label={t("quiz.nextTask")}
        >
          <ChevronRightIcon className="size-4" aria-hidden />
        </Button>
      </nav>

      <div className="border-border flex flex-col gap-6 rounded-xl border bg-card/40 p-4 sm:p-6">
        {isCurrentSubmitted ? (
          <Badge
            variant="secondary"
            className="w-fit border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          >
            {t("quiz.answerSentBadge")}
          </Badge>
        ) : null}

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

        <div
          className={cn(
            "flex flex-col gap-6",
            inputsLocked && "pointer-events-none opacity-80",
          )}
        >
          {current && isClickPuzzle ? (
            <MatchingPuzzleQuestion
              key={current.id}
              options={current.options}
              pairs={currentDraft.puzzlePairs as MatchingPair[]}
              onPairsChange={(pairs) =>
                patchCurrentDraft({ puzzlePairs: pairs })
              }
            />
          ) : current && isDndPuzzle ? (
            <DndMatchingPuzzleQuestion
              key={current.id}
              options={current.options}
              pairs={currentDraft.puzzlePairs as DndMatchingPair[]}
              onPairsChange={(pairs) =>
                patchCurrentDraft({ puzzlePairs: pairs })
              }
            />
          ) : current && isImageLabeling ? (
            <ImageLabelingQuestion
              key={current.id}
              images={imageLabelingMeta?.images ?? []}
              words={shuffledLabelWords}
              assignments={imageLabelingAssignmentsMerged}
              onAssignmentsChange={(assignments) =>
                patchCurrentDraft({ labelAssignments: assignments })
              }
            />
          ) : current && isAnyGroupedFillBlanks && groupedFillBlanksView ? (
            <GroupedFillBlanksTaskQuestion
              key={current.id}
              items={groupedFillBlanksView.items}
              mode={groupedFillBlanksView.mode}
              groupedTyping={currentDraft.groupedFillTyping}
              groupedAssignments={currentDraft.groupedFillAssignments}
              onTypingChange={(typing) =>
                patchCurrentDraft({ groupedFillTyping: typing })
              }
              onAssignmentsChange={(assignments) =>
                patchCurrentDraft({ groupedFillAssignments: assignments })
              }
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
              selections={currentDraft.groupedSelections}
              onSelectionsChange={(selections) =>
                patchCurrentDraft({ groupedSelections: selections })
              }
            />
          ) : current && isOrdering && orderingPlayerView ? (
            <OrderingTaskQuestion
              key={current.id}
              items={orderingPlayerView.items}
              assignments={currentDraft.orderingAssignments}
              onAssignmentsChange={(assignments) =>
                patchCurrentDraft({ orderingAssignments: assignments })
              }
            />
          ) : current && isOrdering ? (
            <p className="text-destructive text-sm" role="alert">
              Не удалось загрузить задание с упорядочиванием.
            </p>
          ) : null}
        </div>
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
        disabled={!canSubmit || isPending || isCurrentSubmitted}
        onClick={runSubmitThenAdvance}
      >
        {isPending
          ? t("quiz.submitting")
          : isCurrentSubmitted
            ? t("quiz.answerAlreadySent")
            : isLast
              ? t("quiz.finishTest")
              : t("quiz.submit")}
      </Button>
    </div>
  );
}
