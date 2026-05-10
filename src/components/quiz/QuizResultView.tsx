"use client";

import type { AttemptResult, SafeTestOption, SafeTestQuestion } from "@/app/actions/test-actions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  parseFillAssignmentsFromAnswerData,
  parseLabelPairsFromAnswerData,
} from "@/lib/quiz-helpers";
import { FillInTheBlanksContentSchema } from "@/lib/validations/fill-in-the-blanks-schema";
import type { Json } from "@/types/database.types";
import type { ReactNode } from "react";

import { FillInTheBlanksQuestion } from "./FillInTheBlanksQuestion";
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

function parseFillAssignmentsBulletproof(data: Json | null): Record<string, string> | null {
  const u = deepUnwrapJson(data);
  if (!u) return null;
  const direct = parseFillAssignmentsFromAnswerData(u);
  if (direct && Object.keys(direct).length > 0) return direct;
  if (typeof u === "object" && !Array.isArray(u)) {
    const rec = u as Record<string, unknown>;
    const as = rec.assignments;
    if (as && typeof as === "object" && !Array.isArray(as)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(as)) {
        if (typeof v === "string") out[k] = v;
      }
      if (Object.keys(out).length > 0) return out;
    }
  }
  return null;
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
  reviewAnswersByQuestionId: Map<string, Record<string, string | null>> | null;
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
  reviewAnswersByQuestionId,
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
      const selected = [...new Set(getSelectedIdsForQuestion(q.id))].sort();
      const correct = [...new Set(reviewCorrectIdsByQuestionId?.get(q.id) ?? [])].sort();
      if (selected.length !== correct.length) return false;
      return selected.every((id, i) => id === correct[i]);
    }

    if (q.type === "fill_in_the_blanks") {
      const p = FillInTheBlanksContentSchema.safeParse(q.content);
      if (!p.success) return false;
      const fromMap = reviewFillByQuestionId?.get(q.id);
      const saved =
        (fromMap && Object.keys(fromMap).length > 0
          ? fromMap
          : parseFillAssignmentsBulletproof(pickAnswerDataFromRows(rows))) ?? {};
      const blankIds = Object.keys(p.data.correctMapping);
      if (Object.keys(saved).length !== blankIds.length) return false;
      return blankIds.every((id) => saved[id] === p.data.correctMapping[id]);
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
        <div className="flex w-full max-w-md flex-col gap-2">
          <div className="flex w-full items-center gap-2 text-sm">
            <span className="font-medium">Готово</span>
            <span className="text-muted-foreground ml-auto tabular-nums">100%</span>
          </div>
          <Progress value={100} className="w-full" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Результат</h2>
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
            Отвечено на вопросов: {result.answeredCount} · {result.percentCorrect}% верно
            от общего числа вопросов в тесте
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
            const answerData = pickAnswerDataFromRows(rows);
            const questionFullyCorrect = isQuestionFullyCorrect(q);
            const selectedIds = getSelectedIdsForQuestion(q.id);

            return (
              <div key={q.id} className="mb-6 space-y-4 rounded-xl border p-6">
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

                {q.type === "fill_in_the_blanks" &&
                  (() => {
                    const p = FillInTheBlanksContentSchema.safeParse(q.content);
                    if (!p.success) {
                      return (
                        <p className="text-muted-foreground text-sm">
                          Не удалось показать разбор этого вопроса.
                        </p>
                      );
                    }
                    const fromMap = reviewFillByQuestionId?.get(q.id);
                    const saved =
                      (fromMap && Object.keys(fromMap).length > 0
                        ? fromMap
                        : parseFillAssignmentsBulletproof(
                            pickAnswerDataFromRows(rows),
                          )) ?? {};
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

      {children}
    </div>
  );
}
