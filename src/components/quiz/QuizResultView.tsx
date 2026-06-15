"use client";

import type { AttemptResult, SafeTestOption, SafeTestQuestion } from "@/app/actions/test-actions";
import { GradingDisplay } from "@/components/quiz/GradingDisplay";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillTypingFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import {
  isGroupedFillBlanksFullyCorrect,
  isGroupedFillInTheBlanksFullyCorrect,
  resolveGroupedFillBlanksPlayerView,
  sumGroupedFillBlanksItemPoints,
} from "@/lib/grouped-fill-blanks-utils";
import {
  isGroupedChoiceContent,
  parseGroupedChoiceItems,
  parseGroupedSelectionsFromAnswerData,
  resolveGroupedChoicePlayerView,
  scoreGroupedChoiceQuestion,
  sumGroupedItemPoints,
} from "@/lib/grouped-choice-utils";
import {
  parseOrderingAssignmentsFromAnswerData,
  parseOrderingItems,
  resolveOrderingPlayerView,
  scoreOrderingQuestion,
  sumOrderingItemPoints,
} from "@/lib/ordering-utils";
import type { Json } from "@/types/database.types";
import {
  parseManualItemGradesFromAnswerData,
  sumManualItemGrades,
} from "@/lib/manual-grading-utils";
import type { ReactNode } from "react";

import { GroupedFillBlanksTaskQuestion } from "./GroupedFillBlanksTaskQuestion";
import { GroupedChoiceTaskQuestion } from "./GroupedChoiceTaskQuestion";
import { OrderingTaskQuestion } from "./OrderingTaskQuestion";
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

function puzzlePartText(content: Json, side: "left" | "right"): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { left?: unknown; right?: unknown })[side];
    if (typeof v === "string") return v;
  }
  return "—";
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
}: QuizResultViewProps) {
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

  function isQuestionFullyCorrect(q: SafeTestQuestion): boolean {
    const rows = reviewRowsByQuestionId?.get(q.id) ?? [];
    const answerData = pickAnswerDataFromRows(rows);

    if (q.type === "matching_puzzle" || q.type === "dnd_puzzle") {
      const pairs = parsePairsFromAnswerData(answerData);
      if (pairs.length !== q.options.length) return false;
      return q.options.every((leftOpt) =>
        pairs.some(
          (p) => p.leftOptionId === leftOpt.id && p.rightOptionId === leftOpt.id,
        ),
      );
    }

    if (
      q.type === "single_choice" ||
      q.type === "multiple_choice" ||
      q.type === "multiple"
    ) {
      if (isGroupedChoiceContent(q.content)) {
        const fromMap = reviewGroupedSelectionsByQuestionId?.get(q.id);
        const selections =
          (fromMap && Object.keys(fromMap).length > 0
            ? fromMap
            : parseGroupedSelectionsBulletproof(answerData)) ?? {};
        const items = parseGroupedChoiceItems(q.content);
        const total = items ? sumGroupedItemPoints(items) : 1;
        const earned = scoreGroupedChoiceQuestion({
          content: q.content,
          questionType: q.type,
          selections,
        });
        return earned >= total;
      }

      const selected = [...new Set(getSelectedIdsForQuestion(q.id))].sort();
      const correct = [...new Set(reviewCorrectIdsByQuestionId?.get(q.id) ?? [])].sort();
      if (selected.length !== correct.length) return false;
      return selected.every((id, i) => id === correct[i]);
    }

    if (q.type === "fill_in_the_blanks" || q.type === "fill_in_the_blanks_multi") {
      const view = resolveGroupedFillBlanksPlayerView({
        content: q.content,
        questionType: q.type,
      });
      if (!view) return false;
      const fromMap = reviewGroupedFillAssignmentsByQuestionId?.get(q.id);
      const saved =
        (fromMap && Object.keys(fromMap).length > 0
          ? fromMap
          : parseGroupedFillAssignmentsBulletproof(
              pickAnswerDataFromRows(rows),
            )) ?? {};
      return isGroupedFillInTheBlanksFullyCorrect({
        content: q.content,
        questionType: q.type,
        groupedAssignments: saved,
      });
    }

    if (q.type === "fill_blanks_typing" || q.type === "fill_blanks_typing_multi") {
      const view = resolveGroupedFillBlanksPlayerView({
        content: q.content,
        questionType: q.type,
      });
      if (!view) return false;
      const fromMap = reviewGroupedFillTypingByQuestionId?.get(q.id);
      const saved =
        (fromMap && Object.keys(fromMap).length > 0
          ? fromMap
          : parseGroupedFillTypingBulletproof(pickAnswerDataFromRows(rows))) ?? {};
      return isGroupedFillBlanksFullyCorrect({
        content: q.content,
        questionType: q.type,
        groupedTyping: saved,
      });
    }

    if (q.type === "text_input") {
      const manualGrades = parseManualItemGradesFromAnswerData(answerData);
      if (manualGrades && !result.requiresManualReview) {
        const view = resolveGroupedFillBlanksPlayerView({
          content: q.content,
          questionType: q.type,
        });
        const maxPoints = view
          ? sumGroupedFillBlanksItemPoints(
              view.items.map((item) => ({
                id: item.id,
                text: "",
                points: item.points,
                segments: item.segments,
                wordBank: item.wordBank,
                correctMapping: item.correctMapping,
              })),
            )
          : 1;
        return sumManualItemGrades(manualGrades) >= maxPoints;
      }
      return false;
    }

    if (q.type === "ordering") {
      const fromMap = reviewOrderingAssignmentsByQuestionId?.get(q.id);
      const assignments =
        (fromMap && Object.keys(fromMap).length > 0
          ? fromMap
          : parseOrderingAssignmentsBulletproof(answerData)) ?? {};
      const items = parseOrderingItems(q.content);
      const total = items ? sumOrderingItemPoints(items) : 1;
      const earned = scoreOrderingQuestion({
        content: q.content,
        assignments,
      });
      return earned >= total;
    }

    if (q.type === "image_labeling") {
      const assignments = resolveImageLabelingAssignments(
        q,
        rows,
        reviewAnswersByQuestionId,
      );
      const meta = parseImageLabelingOptions(q.options);
      return (
        meta.images.length > 0 &&
        meta.images.every(
          (img) => assignments[img.id] !== null && assignments[img.id] === img.id,
        )
      );
    }

    return false;
  }

  const totalCorrectQuestions = questions.filter((q) => isQuestionFullyCorrect(q)).length;
  const isForKids = result.isForKids;
  const requiresManualReview = result.requiresManualReview;

  return (
    <div className="flex flex-col gap-10 py-8">
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
          <div className="flex w-full max-w-md flex-col gap-2">
            <div className="flex w-full items-center gap-2 text-sm">
              <span className="font-medium">
                {requiresManualReview ? "Отправлено на проверку" : "Готово"}
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
          <h2 className="text-2xl font-semibold tracking-tight">Результат</h2>
          {requiresManualReview ? (
            <p className="text-muted-foreground text-sm max-w-lg">
              В тесте есть развёрнутые ответы. Преподаватель проверит их вручную —
              автоматическая оценка за эти задания не выставляется.
            </p>
          ) : null}
          {isForKids ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {requiresManualReview ? (
                <p className="text-muted-foreground text-sm">
                  Ответы отправлены преподавателю. Жди проверки!
                </p>
              ) : (
                <>
                  <GradingDisplay
                    score={result.score}
                    isForKids
                    totalPossiblePoints={result.totalPossiblePoints}
                  />
                  <p className="text-muted-foreground text-sm">
                    Молодец! Посмотри разбор заданий ниже.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {!requiresManualReview ? (
                <>
                  <p className="text-muted-foreground text-lg">
                    Правильных заданий:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {totalCorrectQuestions}
                    </span>{" "}
                    из{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {questions.length}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Набрано баллов: {result.earnedPoints} / {result.totalPossiblePoints}
                    {" · "}
                    Отвечено на заданий: {result.answeredCount}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Автоматически проверенные задания: {result.earnedPoints} /{" "}
                  {result.totalPossiblePoints} баллов (предварительно)
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <section className="border-border w-full rounded-xl border bg-card/30 p-4 text-left shadow-sm sm:p-6">
        <h3 className="text-foreground mb-4 text-lg font-semibold tracking-tight">
          Разбор ответов
        </h3>
        <div className="flex flex-col gap-10">
          {questions.map((q, index) => {
            const rows = reviewRowsByQuestionId?.get(q.id) ?? [];
            const answerData = pickAnswerDataFromRows(rows);
            const questionFullyCorrect = isQuestionFullyCorrect(q);
            const selectedIds = getSelectedIdsForQuestion(q.id);
            const textInputManualGrades =
              q.type === "text_input"
                ? parseManualItemGradesFromAnswerData(answerData)
                : null;
            const textInputGraded =
              q.type === "text_input" &&
              textInputManualGrades &&
              !result.requiresManualReview;

            return (
              <div key={q.id} className="mb-6 space-y-4 rounded-xl border p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-foreground text-base font-medium leading-snug">
                    Вопрос {index + 1}: {textFromContent(q.content)}
                  </h4>
                  <Badge
                    variant={
                      q.type === "text_input" && !textInputGraded
                        ? "outline"
                        : questionFullyCorrect
                          ? "secondary"
                          : "destructive"
                    }
                    className={
                      q.type === "text_input" && !textInputGraded
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                        : questionFullyCorrect
                          ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : undefined
                    }
                  >
                    {q.type === "text_input"
                      ? textInputGraded
                        ? questionFullyCorrect
                          ? "Верно"
                          : "Частично / неверно"
                        : "На проверке"
                      : questionFullyCorrect
                        ? "Верно"
                        : "Ошибка"}
                  </Badge>
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
                  q.type === "multiple") &&
                  (() => {
                    if (isGroupedChoiceContent(q.content)) {
                      const playerView = resolveGroupedChoicePlayerView({
                        content: q.content,
                        questionType: q.type,
                        legacyOptions: q.options,
                      });
                      const fromMap = reviewGroupedSelectionsByQuestionId?.get(q.id);
                      const selections =
                        (fromMap && Object.keys(fromMap).length > 0
                          ? fromMap
                          : parseGroupedSelectionsBulletproof(
                              pickAnswerDataFromRows(rows),
                            )) ?? {};
                      const correctByItemId =
                        reviewGroupedCorrectByQuestionId?.get(q.id) ?? {};
                      return (
                        <GroupedChoiceTaskQuestion
                          items={playerView.items}
                          isMultiple={
                            q.type === "multiple_choice" || q.type === "multiple"
                          }
                          selections={selections}
                          isReviewMode
                          correctByItemId={correctByItemId}
                        />
                      );
                    }

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
                    const saved =
                      (fromMap && Object.keys(fromMap).length > 0
                        ? fromMap
                        : parseGroupedFillAssignmentsBulletproof(
                            pickAnswerDataFromRows(rows),
                          )) ?? {};
                    return (
                      <GroupedFillBlanksTaskQuestion
                        items={view.items}
                        mode={view.mode}
                        groupedAssignments={saved}
                        isReviewMode
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
                    const saved =
                      (fromMap && Object.keys(fromMap).length > 0
                        ? fromMap
                        : parseGroupedFillTypingBulletproof(
                            pickAnswerDataFromRows(rows),
                          )) ?? {};
                    return (
                      <GroupedFillBlanksTaskQuestion
                        items={view.items}
                        mode={view.mode}
                        groupedTyping={saved}
                        isReviewMode
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
                    const saved =
                      (fromMap && Object.keys(fromMap).length > 0
                        ? fromMap
                        : parseGroupedFillTypingBulletproof(
                            pickAnswerDataFromRows(rows),
                          )) ?? {};
                    return (
                      <div className="space-y-3">
                        <GroupedFillBlanksTaskQuestion
                          items={view.items}
                          mode={view.mode}
                          groupedTyping={saved}
                          isReviewMode
                        />
                        {textInputManualGrades &&
                        !result.requiresManualReview ? (
                          <ul className="text-muted-foreground space-y-1 text-xs">
                            {view.items.map((item, itemIndex) => (
                              <li key={item.id}>
                                Вопрос {itemIndex + 1}:{" "}
                                <span className="text-foreground tabular-nums font-medium">
                                  {textInputManualGrades[item.id] ?? 0}
                                </span>{" "}
                                / {item.points} баллов
                              </li>
                            ))}
                          </ul>
                        ) : result.requiresManualReview ? (
                          <p className="text-muted-foreground text-xs">
                            Ответ отправлен на проверку преподавателю.
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

      {children}
    </div>
  );
}
