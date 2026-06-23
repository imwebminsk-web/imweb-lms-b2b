"use client";

import type { AttemptResult, SafeTestQuestion } from "@/app/actions/test-actions";
import { GradingDisplay } from "@/components/quiz/GradingDisplay";
import { useLanguage } from "@/components/providers/language-provider";
import type { TranslationKey } from "@/lib/i18n/dict";
import { Progress } from "@/components/ui/progress";
import {
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillTypingFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import {
  alignGroupedFillAnswersToPlayerItems,
  bruteForceExtractTypingValue,
  hasGroupedFillTypingContent,
  normalizeItemTypingForBlanks,
  resolveBlankIdsForGroupedFillBlanksItem,
  resolveGroupedFillBlanksPlayerView,
  resolveReviewGroupedFillTypingForPlayer,
  type GroupedFillBlanksPlayerItem,
} from "@/lib/grouped-fill-blanks-utils";
import {
  LEGACY_GROUPED_ITEM_ID,
  parseGroupedSelectionsFromAnswerData,
  resolveGroupedChoicePlayerView,
} from "@/lib/grouped-choice-utils";
import {
  parseOrderingAssignmentsFromAnswerData,
  resolveOrderingPlayerView,
} from "@/lib/ordering-utils";
import type { Json } from "@/types/database.types";
import { parseTaskPresentation } from "@/lib/utils/task-content";
import { plainTextFromRichContent } from "@/lib/utils/rich-text-content";
import {
  parseManualItemGradesFromAnswerData,
} from "@/lib/manual-grading-utils";
import {
  resolveGroupedChoiceItemScores,
  resolveGroupedFillItemScores,
  resolveOrderingItemScores,
  resolveTaskPointsForReview,
  type ReviewItemScore,
} from "@/lib/quiz-result-scoring";
import {
  getGradingVisuals,
  type GradingColor,
} from "@/lib/utils/grading";
import type { ReactNode } from "react";

import { GroupedFillBlanksTaskQuestion } from "./GroupedFillBlanksTaskQuestion";
import { GroupedChoiceTaskQuestion } from "./GroupedChoiceTaskQuestion";
import { OrderingTaskQuestion } from "./OrderingTaskQuestion";
import { QuizTaskInstruction } from "./QuizTaskInstruction";
import { ReviewPuzzlePairCard } from "./ReviewPuzzlePairCard";
import {
  buildAssignmentsFromLabelPairs,
  ImageLabelingQuestion,
  parseImageLabelingOptions,
} from "./ImageLabelingQuestion";

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

/** Снимает до 3 уровней JSON-строк (в т.ч. double-stringify из БД). */
function deepUnwrapJson(raw: Json | null): Json | null {
  if (raw == null) return null;
  let v: unknown = raw;
  let depth = 0;
  while (typeof v === "string" && depth < 3) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
    depth++;
  }
  if (typeof v === "string") return null;
  return v as Json;
}

type PuzzlePair = { leftOptionId: string; rightOptionId: string };

function normalizePuzzlePairItem(p: unknown): PuzzlePair | null {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = p as Record<string, unknown>;
  const left =
    (typeof o.leftOptionId === "string" && o.leftOptionId) ||
    (typeof o.left === "string" && o.left) ||
    (typeof o.from === "string" && o.from) ||
    null;
  const right =
    (typeof o.rightOptionId === "string" && o.rightOptionId) ||
    (typeof o.right === "string" && o.right) ||
    (typeof o.to === "string" && o.to) ||
    null;
  if (!left || !right) return null;
  return { leftOptionId: left, rightOptionId: right };
}

function normalizePuzzlePairArray(raw: unknown[]): PuzzlePair[] {
  const out: PuzzlePair[] = [];
  for (const item of raw) {
    const n = normalizePuzzlePairItem(item);
    if (n) out.push(n);
  }
  return out;
}

/** Пазл matching/dnd: строка, `{ pairs }`, `{ matchingPairs }` или массив пар. */
function parsePairsFromAnswerData(answerData: Json | null): PuzzlePair[] {
  if (!answerData) return [];
  let data: unknown = answerData;
  let depth = 0;
  while (typeof data === "string" && depth < 3) {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
    depth++;
  }
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) {
    return normalizePuzzlePairArray(data);
  }
  const rec = data as Record<string, unknown>;
  if (Array.isArray(rec.pairs)) {
    return normalizePuzzlePairArray(rec.pairs);
  }
  if (Array.isArray(rec.matchingPairs)) {
    return normalizePuzzlePairArray(rec.matchingPairs);
  }
  return [];
}

function parseOrderingAssignmentsBulletproof(
  data: Json | null,
): Record<string, string[]> | null {
  const u = deepUnwrapJson(data);
  if (!u) return null;
  return parseOrderingAssignmentsFromAnswerData(u);
}

function parseGroupedSelectionsBulletproof(
  data: Json | null,
): Record<string, string[]> | null {
  const u = deepUnwrapJson(data);
  if (!u) return null;
  return parseGroupedSelectionsFromAnswerData(u);
}

function parseGroupedFillTypingBulletproof(
  data: Json | null,
): Record<string, Record<string, string>> | null {
  const u = deepUnwrapJson(data);
  if (!u) return null;
  return parseGroupedFillTypingFromAnswerData(u);
}

function parseFillTypingBulletproof(data: Json | null): Record<string, string> | null {
  const grouped = parseGroupedFillTypingBulletproof(data);
  if (!grouped) return null;
  const itemIds = Object.keys(grouped);
  if (itemIds.length === 1) {
    return grouped[itemIds[0]!] ?? null;
  }
  const flat: Record<string, string> = {};
  for (const itemTyping of Object.values(grouped)) {
    Object.assign(flat, itemTyping);
  }
  return Object.keys(flat).length > 0 ? flat : null;
}

function parseGroupedFillAssignmentsBulletproof(
  data: Json | null,
): Record<string, Record<string, string>> | null {
  const u = deepUnwrapJson(data);
  if (!u) return null;
  return parseGroupedFillAssignmentsFromAnswerData(u);
}

function parseFillAssignmentsBulletproof(data: Json | null): Record<string, string> | null {
  const grouped = parseGroupedFillAssignmentsBulletproof(data);
  if (!grouped) return null;
  const itemIds = Object.keys(grouped);
  if (itemIds.length === 1) {
    return grouped[itemIds[0]!] ?? null;
  }
  const flat: Record<string, string> = {};
  for (const itemAssignments of Object.values(grouped)) {
    Object.assign(flat, itemAssignments);
  }
  return Object.keys(flat).length > 0 ? flat : null;
}

function pickAnswerDataFromRows(
  rows: { option_id: string; answer_data: Json | null }[],
): Json | null {
  for (const r of rows) {
    const u = deepUnwrapJson(r.answer_data);
    if (u === null || u === undefined) continue;
    if (typeof u === "object" && !Array.isArray(u) && Object.keys(u).length === 0) {
      continue;
    }
    return u;
  }
  return null;
}

/** Карта картинка→слово: сначала `reviewAnswersByQuestionId`, иначе из `labelPairs` в строках ответа. */
function resolveImageLabelingAssignments(
  q: SafeTestQuestion,
  rows: { option_id: string; answer_data: Json | null }[],
  reviewAnswersByQuestionId: Map<string, Record<string, string | null>> | null,
): Record<string, string | null> {
  const meta = parseImageLabelingOptions(q.options);
  const fromMap = reviewAnswersByQuestionId?.get(q.id);
  const mapHasData =
    fromMap &&
    Object.values(fromMap).some((v) => v != null && String(v).trim() !== "");
  if (mapHasData && fromMap) return fromMap;

  for (const row of rows) {
    const u = deepUnwrapJson(row.answer_data);
    const pairs = parseLabelPairsFromAnswerData(u);
    if (pairs) {
      try {
        const built = buildAssignmentsFromLabelPairs(
          pairs,
          meta.images.map((i) => i.id),
        );
        if (Object.values(built).some((v) => v != null && String(v).trim() !== "")) {
          return built;
        }
      } catch {
        /* контент вопроса или пары повреждены */
      }
    }
  }
  return Object.fromEntries(meta.images.map((i) => [i.id, null] as const));
}

function resolveReviewGroupedFillSaved(
  rows: { option_id: string; answer_data: Json | null }[],
  fromMap: Record<string, Record<string, string>> | undefined,
  parseGrouped: (data: Json | null) => Record<string, Record<string, string>> | null,
  parseFlat: (data: Json | null) => Record<string, string> | null,
  itemIds: string[],
): Record<string, Record<string, string>> {
  let saved =
    fromMap && Object.keys(fromMap).length > 0
      ? fromMap
      : {};

  if (Object.keys(saved).length === 0) {
    for (const row of rows) {
      const parsed = parseGrouped(row.answer_data);
      if (parsed && Object.keys(parsed).length > 0) {
        saved = parsed;
        break;
      }
    }
  }

  if (Object.keys(saved).length === 0) {
    for (const row of rows) {
      const flat = parseFlat(row.answer_data);
      if (flat && itemIds.length === 1) {
        saved = { [itemIds[0]!]: flat };
        break;
      }
    }
  }

  return alignGroupedFillAnswersToPlayerItems(saved, itemIds.map((id) => ({ id })));
}

function resolveReviewGroupedFillTypingSaved(
  rows: { option_id: string; answer_data: Json | null }[],
  fromMap: Record<string, Record<string, string>> | undefined,
  items: GroupedFillBlanksPlayerItem[],
): Record<string, Record<string, string>> {
  const saved = resolveReviewGroupedFillTypingForPlayer({
    rows,
    fromMap,
    items,
  });

  if (hasGroupedFillTypingContent(saved)) {
    return saved;
  }

  const rawAnswer = pickAnswerDataFromRows(rows);
  if (rawAnswer == null) {
    return saved;
  }

  const brute: Record<string, Record<string, string>> = {};
  for (const item of items) {
    const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
    const text = bruteForceExtractTypingValue(rawAnswer);
    if (text.trim()) {
      brute[item.id] = normalizeItemTypingForBlanks(text, blankIds);
    }
  }

  if (!hasGroupedFillTypingContent(brute)) {
    return saved;
  }

  return resolveReviewGroupedFillTypingForPlayer({
    rows: [{ answer_data: rawAnswer }],
    fromMap: brute,
    items,
  });
}

function resolveReviewChoiceSelections(
  rows: { option_id: string; answer_data: Json | null }[],
  fromMap: Record<string, string[]> | undefined,
  selectedIds: string[],
): Record<string, string[]> {
  const parsed = parseGroupedSelectionsBulletproof(pickAnswerDataFromRows(rows));
  const selections =
    fromMap && Object.keys(fromMap).length > 0 ? fromMap : (parsed ?? {});

  if (Object.keys(selections).length > 0) return selections;
  if (selectedIds.length > 0) {
    return { [LEGACY_GROUPED_ITEM_ID]: selectedIds };
  }
  return {};
}

function resolveReviewChoiceCorrect(
  correctByItemId: Record<string, string[]>,
  correctIds: string[],
): Record<string, string[]> {
  if (Object.keys(correctByItemId).length > 0) return correctByItemId;
  if (correctIds.length > 0) {
    return { [LEGACY_GROUPED_ITEM_ID]: correctIds };
  }
  return {};
}

function questionInstructionFallback(q: SafeTestQuestion): string {
  if (
    q.type === "fill_in_the_blanks" ||
    q.type === "fill_in_the_blanks_multi"
  ) {
    return "Заполните пропуски, перетаскивая слова из банка";
  }
  if (
    q.type === "fill_blanks_typing" ||
    q.type === "fill_blanks_typing_multi"
  ) {
    return "Заполните пропуски, вводя слова вручную";
  }
  if (q.type === "text_input") {
    return "Развёрнутый ответ";
  }
  if (q.type === "ordering") {
    const view = resolveOrderingPlayerView({ content: q.content });
    return view?.taskInstruction ?? "Вопрос";
  }
  if (
    q.type === "single_choice" ||
    q.type === "multiple_choice" ||
    q.type === "multiple"
  ) {
    const view = resolveGroupedChoicePlayerView({
      content: q.content,
      questionType: q.type,
      legacyOptions: q.options,
    });
    return plainTextFromRichContent(view.taskInstruction) || "Вопрос";
  }
  return plainTextFromRichContent(textFromContent(q.content)) || "Вопрос";
}

export type QuizResultViewProps = {
  questions: SafeTestQuestion[];
  result: AttemptResult;
  /** Если true — над «Готово» показываются название и описание теста (удобно в Sheet). */
  showTestMeta?: boolean;
  testTitle?: string | null;
  testDescription?: string | null;
  reviewRowsByQuestionId: Map<
    string,
    { option_id: string; answer_data: Json | null }[]
  > | null;
  reviewCorrectIdsByQuestionId: Map<string, string[]> | null;
  reviewFillByQuestionId: Map<string, Record<string, string>> | null;
  reviewGroupedFillTypingByQuestionId?: Map<
    string,
    Record<string, Record<string, string>>
  > | null;
  reviewGroupedFillAssignmentsByQuestionId?: Map<
    string,
    Record<string, Record<string, string>>
  > | null;
  reviewAnswersByQuestionId: Map<string, Record<string, string | null>> | null;
  reviewGroupedSelectionsByQuestionId?: Map<string, Record<string, string[]>> | null;
  reviewGroupedCorrectByQuestionId?: Map<string, Record<string, string[]>> | null;
  reviewOrderingAssignmentsByQuestionId?: Map<string, Record<string, string[]>> | null;
  /** Например кнопки «Вернуться к уроку» под разбором — для Sheet не передаётся. */
  children?: ReactNode;
  /** Только блок разбора вопросов — без шапки «Результат» (страница проверки). */
  reviewOnly?: boolean;
  /** Смещение номера вопроса в подписи «Вопрос N» (когда передан один вопрос из полного теста). */
  questionIndexOffset?: number;
  /** Анимация kids-эмодзи после прохождения теста (только QuizPlayer). */
  celebrateKidsEmoji?: boolean;
};

export function QuizResultView({
  questions,
  result,
  showTestMeta = false,
  testTitle,
  testDescription,
  reviewRowsByQuestionId,
  reviewCorrectIdsByQuestionId,
  reviewFillByQuestionId,
  reviewGroupedFillTypingByQuestionId,
  reviewGroupedFillAssignmentsByQuestionId,
  reviewAnswersByQuestionId,
  reviewGroupedSelectionsByQuestionId,
  reviewGroupedCorrectByQuestionId,
  reviewOrderingAssignmentsByQuestionId,
  children,
  reviewOnly = false,
  questionIndexOffset = 0,
  celebrateKidsEmoji = false,
}: QuizResultViewProps) {
  const { t } = useLanguage();
  const correctIdsMap = reviewCorrectIdsByQuestionId ?? new Map();

  function buildReviewItemScores(
    q: SafeTestQuestion,
    rows: { option_id: string; answer_data: Json | null }[],
    answerData: Json | null,
  ): Record<string, ReviewItemScore> | undefined {
    if (
      q.type === "single_choice" ||
      q.type === "multiple_choice" ||
      q.type === "multiple"
    ) {
      const fromMap = reviewGroupedSelectionsByQuestionId?.get(q.id);
      const selections = resolveReviewChoiceSelections(
        rows,
        fromMap,
        getSelectedIdsForQuestion(q.id),
      );
      const correctByItemId = resolveReviewChoiceCorrect(
        reviewGroupedCorrectByQuestionId?.get(q.id) ?? {},
        reviewCorrectIdsByQuestionId?.get(q.id) ?? [],
      );
      return resolveGroupedChoiceItemScores({
        question: q,
        selections,
        correctByItemId,
      });
    }

    if (q.type === "ordering") {
      const fromMap = reviewOrderingAssignmentsByQuestionId?.get(q.id);
      const assignments =
        (fromMap && Object.keys(fromMap).length > 0
          ? fromMap
          : parseOrderingAssignmentsBulletproof(answerData)) ?? {};
      return resolveOrderingItemScores({ content: q.content, assignments });
    }

    if (
      q.type === "fill_in_the_blanks" ||
      q.type === "fill_in_the_blanks_multi"
    ) {
      const view = resolveGroupedFillBlanksPlayerView({
        content: q.content,
        questionType: q.type,
      });
      if (!view) return undefined;
      const fromMap = reviewGroupedFillAssignmentsByQuestionId?.get(q.id);
      const saved = resolveReviewGroupedFillSaved(
        rows,
        fromMap,
        parseGroupedFillAssignmentsBulletproof,
        parseFillAssignmentsBulletproof,
        view.items.map((item) => item.id),
      );
      return resolveGroupedFillItemScores({
        question: q,
        mode: view.mode,
        groupedAssignments: saved,
      });
    }

    if (
      q.type === "fill_blanks_typing" ||
      q.type === "fill_blanks_typing_multi" ||
      q.type === "text_input"
    ) {
      const view = resolveGroupedFillBlanksPlayerView({
        content: q.content,
        questionType: q.type,
      });
      if (!view) return undefined;
      const fromMap = reviewGroupedFillTypingByQuestionId?.get(q.id);
      const saved = resolveReviewGroupedFillTypingSaved(
        rows,
        fromMap,
        view.items,
      );
      const manualGrades =
        q.type === "text_input"
          ? parseManualItemGradesFromAnswerData(answerData)
          : null;
      return resolveGroupedFillItemScores({
        question: q,
        mode: view.mode,
        groupedTyping: saved,
        manualGrades,
        pendingReview:
          q.type === "text_input" ? result.requiresManualReview : false,
      });
    }

    return undefined;
  }

  function getSelectedIdsForQuestion(questionId: string) {
    const rows = reviewRowsByQuestionId?.get(questionId) ?? [];
    for (const row of rows) {
      const ad = deepUnwrapJson(row.answer_data);
      if (
        ad &&
        typeof ad === "object" &&
        !Array.isArray(ad) &&
        Array.isArray((ad as { selectedOptionIds?: unknown }).selectedOptionIds)
      ) {
        const ids = (ad as { selectedOptionIds: unknown[] }).selectedOptionIds.filter(
          (x): x is string => typeof x === "string",
        );
        if (ids.length > 0) return ids;
      }
    }
    return rows.map((r) => r.option_id).filter((id) => id.trim() !== "");
  }

  const isForKids = result.isForKids;
  const requiresManualReview = result.requiresManualReview;
  const kidsGradingVisuals = isForKids
    ? getGradingVisuals(result.score, true, result.totalPossiblePoints)
    : null;

  function kidsReviewDynamicKey(color: GradingColor): TranslationKey {
    return `quizResult.kidsReviewDynamic.${color}`;
  }

  const questionsSection = (
    <section
      className={
        reviewOnly
          ? "w-full min-w-0 text-left"
          : "border-border w-full min-w-0 rounded-xl border bg-card/30 p-4 text-left shadow-sm sm:p-6"
      }
    >
      {!reviewOnly ? (
        <h3 className="text-foreground mb-4 text-lg font-semibold tracking-tight">
          {t("quizResult.reviewBreakdown")}
        </h3>
      ) : null}
      <div className={reviewOnly ? "flex flex-col gap-0" : "flex flex-col gap-10"}>
        {questions.map((q, index) => {
          const displayIndex = questionIndexOffset + index;
          const rows = reviewRowsByQuestionId?.get(q.id) ?? [];
          const answerData = pickAnswerDataFromRows(rows);
          const taskPoints = resolveTaskPointsForReview(q, rows, correctIdsMap);
          const reviewItemScores = buildReviewItemScores(q, rows, answerData);
          const selectedIds = getSelectedIdsForQuestion(q.id);

          return (
            <div key={q.id} className="mb-6 min-w-0 w-full space-y-4 rounded-xl border p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-muted-foreground text-sm font-medium">
                    {t("quizResult.task")} {displayIndex + 1}
                  </p>
                  <QuizTaskInstruction
                    task={parseTaskPresentation(q.content, 0)}
                    fallbackTitle={questionInstructionFallback(q)}
                    variant="section"
                    isReviewMode
                  />
                </div>
                <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                  {t("quizResult.taskPoints")}: {taskPoints.earned} / {taskPoints.max}
                </span>
              </div>

              {(q.type === "matching_puzzle" || q.type === "dnd_puzzle") &&
                (() => {
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
                          <ReviewPuzzlePairCard
                            key={`${q.id}-${leftOpt.id}`}
                            isCorrect={isCorrect}
                            leftContent={leftOpt.content}
                            userRightContent={userRight?.content ?? null}
                            correctRightContent={
                              !isCorrect && correctRight ? correctRight.content : null
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })()}

              {(q.type === "single_choice" ||
                q.type === "multiple_choice" ||
                q.type === "multiple") &&
                (() => {
                  const playerView = resolveGroupedChoicePlayerView({
                    content: q.content,
                    questionType: q.type,
                    legacyOptions: q.options,
                  });
                  const fromMap = reviewGroupedSelectionsByQuestionId?.get(q.id);
                  const selections = resolveReviewChoiceSelections(
                    rows,
                    fromMap,
                    selectedIds,
                  );
                  const correctByItemId = resolveReviewChoiceCorrect(
                    reviewGroupedCorrectByQuestionId?.get(q.id) ?? {},
                    reviewCorrectIdsByQuestionId?.get(q.id) ?? [],
                  );
                  return (
                    <GroupedChoiceTaskQuestion
                      items={playerView.items}
                      isMultiple={
                        q.type === "multiple_choice" || q.type === "multiple"
                      }
                      selections={selections}
                      isReviewMode
                      correctByItemId={correctByItemId}
                      reviewItemScores={reviewItemScores}
                    />
                  );
                })()}

              {q.type === "ordering" &&
                (() => {
                  const playerView = resolveOrderingPlayerView({
                    content: q.content,
                  });
                  if (!playerView) {
                    return (
                      <p className="text-muted-foreground text-sm">
                        Не удалось показать разбор этого вопроса.
                      </p>
                    );
                  }
                  const fromMap = reviewOrderingAssignmentsByQuestionId?.get(q.id);
                  const assignments =
                    (fromMap && Object.keys(fromMap).length > 0
                      ? fromMap
                      : parseOrderingAssignmentsBulletproof(
                          pickAnswerDataFromRows(rows),
                        )) ?? {};
                  const correctByItemId =
                    reviewGroupedCorrectByQuestionId?.get(q.id) ?? {};
                  return (
                    <OrderingTaskQuestion
                      items={playerView.items}
                      assignments={assignments}
                      isReviewMode
                      correctByItemId={correctByItemId}
                      reviewItemScores={reviewItemScores}
                    />
                  );
                })()}

              {q.type === "image_labeling" &&
                (() => {
                  const meta = parseImageLabelingOptions(q.options);
                  const assignments = resolveImageLabelingAssignments(
                    q,
                    rows,
                    reviewAnswersByQuestionId,
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

              {(q.type === "fill_in_the_blanks" ||
                q.type === "fill_in_the_blanks_multi") &&
                (() => {
                  const view = resolveGroupedFillBlanksPlayerView({
                    content: q.content,
                    questionType: q.type,
                  });
                  if (!view) {
                    return (
                      <p className="text-muted-foreground text-sm">
                        Не удалось показать разбор этого вопроса.
                      </p>
                    );
                  }
                  const fromMap =
                    reviewGroupedFillAssignmentsByQuestionId?.get(q.id);
                  const saved = resolveReviewGroupedFillSaved(
                    rows,
                    fromMap,
                    parseGroupedFillAssignmentsBulletproof,
                    parseFillAssignmentsBulletproof,
                    view.items.map((item) => item.id),
                  );
                  return (
                    <GroupedFillBlanksTaskQuestion
                      items={view.items}
                      mode={view.mode}
                      groupedAssignments={saved}
                      isReviewMode
                      reviewItemScores={reviewItemScores}
                      reviewRawAnswer={pickAnswerDataFromRows(rows)}
                    />
                  );
                })()}

              {(q.type === "fill_blanks_typing" ||
                q.type === "fill_blanks_typing_multi") &&
                (() => {
                  const view = resolveGroupedFillBlanksPlayerView({
                    content: q.content,
                    questionType: q.type,
                  });
                  if (!view) {
                    return (
                      <p className="text-muted-foreground text-sm">
                        Не удалось показать разбор этого вопроса.
                      </p>
                    );
                  }
                  const fromMap = reviewGroupedFillTypingByQuestionId?.get(q.id);
                  const saved = resolveReviewGroupedFillTypingSaved(
                    rows,
                    fromMap,
                    view.items,
                  );
                  return (
                    <GroupedFillBlanksTaskQuestion
                      items={view.items}
                      mode={view.mode}
                      groupedTyping={saved}
                      isReviewMode
                      reviewItemScores={reviewItemScores}
                      reviewRawAnswer={pickAnswerDataFromRows(rows)}
                    />
                  );
                })()}

              {q.type === "text_input" &&
                (() => {
                  const view = resolveGroupedFillBlanksPlayerView({
                    content: q.content,
                    questionType: q.type,
                  });
                  if (!view) {
                    return (
                      <p className="text-muted-foreground text-sm">
                        Не удалось показать развёрнутый ответ.
                      </p>
                    );
                  }
                  const fromMap = reviewGroupedFillTypingByQuestionId?.get(q.id);
                  const saved = resolveReviewGroupedFillTypingSaved(
                    rows,
                    fromMap,
                    view.items,
                  );
                  return (
                    <div className="space-y-3">
                      <GroupedFillBlanksTaskQuestion
                        items={view.items}
                        mode={view.mode}
                        groupedTyping={saved}
                        isReviewMode
                        reviewItemScores={reviewItemScores}
                        reviewRawAnswer={pickAnswerDataFromRows(rows)}
                      />
                      {result.requiresManualReview ? (
                        <p className="text-muted-foreground text-xs">
                          {t("quizResult.textInputPending")}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </section>
  );

  if (reviewOnly) {
    return questionsSection;
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-6 py-4 sm:gap-10 sm:py-8">
      {showTestMeta &&
      ((testTitle != null && testTitle !== "") || testDescription) ? (
        <header className="space-y-1 text-center">
          {testTitle ? (
            <p className="text-muted-foreground text-sm font-medium">{testTitle}</p>
          ) : null}
          {testDescription ? (
            <p className="text-muted-foreground text-xs">{testDescription}</p>
          ) : null}
        </header>
      ) : null}

      <div className="flex flex-col items-center gap-6 text-center">
        {!isForKids ? (
          <div className="flex w-full max-w-2xl flex-col gap-2">
            <div className="flex w-full items-center gap-2 text-sm">
              <span className="font-medium">
                {requiresManualReview
                  ? t("quizResult.submittedForReview")
                  : t("quizResult.performance")}
              </span>
              {!requiresManualReview ? (
                <span className="text-muted-foreground ml-auto tabular-nums">
                  {result.percentCorrect}%
                </span>
              ) : null}
            </div>
            {!requiresManualReview ? (
              <Progress value={result.percentCorrect} className="w-full" />
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("quizResult.result")}
          </h2>
          {requiresManualReview ? (
            <p className="text-muted-foreground max-w-3xl text-sm">
              {t("quizResult.manualReviewHint")}
            </p>
          ) : null}
          {isForKids ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {requiresManualReview ? (
                <p className="text-muted-foreground text-sm">
                  {t("quizResult.kidsWaitReview")}
                </p>
              ) : (
                <>
                  <GradingDisplay
                    score={result.score}
                    isForKids
                    totalPossiblePoints={result.totalPossiblePoints}
                    animate={celebrateKidsEmoji}
                  />
                  <p className="text-muted-foreground text-sm">
                    {kidsGradingVisuals?.color
                      ? t(kidsReviewDynamicKey(kidsGradingVisuals.color))
                      : null}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {!requiresManualReview ? (
                <p className="text-muted-foreground text-lg">
                  {t("quizResult.earnedPoints")}:{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {result.earnedPoints}
                  </span>{" "}
                  {t("quiz.of")}{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {result.totalPossiblePoints}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("quizResult.preliminaryScore")}: {result.earnedPoints} /{" "}
                  {result.totalPossiblePoints} {t("quizResult.preliminarySuffix")}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {questionsSection}

      {children}
    </div>
  );
}
