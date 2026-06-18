import {
  correctTextForBlank,
  isFillBlankTypingAnswerCorrect,
} from "@/lib/fill-blanks-scoring";
import {
  parseFillAssignmentsFromAnswerData,
  parseFillTypingFromAnswerData,
} from "@/lib/quiz-helpers";
import { hasRichTextContent } from "@/lib/utils/rich-text-content";
import {
  FillInTheBlanksContentSchema,
  TextInputContentSchema,
  blankIdsFromSegments,
  type FillInTheBlanksContent,
  type FillInTheBlanksSegment,
  type FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";
import {
  GROUPED_FILL_BLANKS_ANCHOR_TEXT,
  LEGACY_GROUPED_FILL_ITEM_ID,
  groupedFillBlanksContentSchema,
  groupedFillInTheBlanksContentSchema,
  groupedTextInputContentSchema,
  type GroupedFillBlanksItem,
} from "@/lib/validations/grouped-fill-blanks-schema";
import type { Json } from "@/types/database.types";
import { resolveQuestionPoints } from "@/lib/utils/grading";

export {
  GROUPED_FILL_BLANKS_ANCHOR_TEXT,
  LEGACY_GROUPED_FILL_ITEM_ID,
} from "@/lib/validations/grouped-fill-blanks-schema";

export type GroupedFillBlanksMode = "dnd" | "typing" | "text_input";

export type GroupedFillBlanksPlayerItem = {
  id: string;
  points: number;
  /** HTML с `<span data-blank-id>` вместо `[слово]`; null — fallback на segments. */
  parsedHtml: string | null;
  segments: FillInTheBlanksSegment[];
  wordBank: FillInTheBlanksWord[];
  correctMapping: Record<string, string>;
};

/** Убирает HTML-теги из строки (для ответов внутри скобок). */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapePlainTextForHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Объединяет legacy `description` + plain `text` в единый HTML для редактора. */
export function normalizeGroupedFillBlanksItemText(item: {
  text?: string | null;
  description?: string | null;
}): string {
  const text = item.text?.trim() ?? "";
  const description = item.description?.trim() ?? "";

  if (text && (text.includes("<") || hasRichTextContent(text))) {
    return text;
  }

  if (description && text) {
    const bracketBlock = text.includes("[")
      ? `<p>${escapePlainTextForHtml(text)}</p>`
      : "";
    return description + bracketBlock;
  }

  if (description) return description;

  if (text) {
    return `<p>${escapePlainTextForHtml(text)}</p>`;
  }

  return "";
}

function shuffleInPlace<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

function newBlankId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Math.random().toString(36).slice(2, 11)}`;
}

function mapItemToPlayerItem(
  item: Pick<
    GroupedFillBlanksItem,
    | "id"
    | "points"
    | "text"
    | "description"
    | "parsedHtml"
    | "segments"
    | "wordBank"
    | "correctMapping"
  >,
  mode: GroupedFillBlanksMode,
): GroupedFillBlanksPlayerItem {
  const normalizedText = normalizeGroupedFillBlanksItemText(item);
  const storedParsed = item.parsedHtml?.trim() || null;
  const reparsed =
    !storedParsed && normalizedText
      ? parseGroupedFillBlanksItemText(normalizedText, mode, [])
      : null;

  if (reparsed) {
    return {
      id: item.id,
      points: resolveQuestionPoints(item.points),
      parsedHtml: reparsed.parsedHtml ?? null,
      segments: reparsed.segments,
      wordBank: reparsed.wordBank,
      correctMapping: reparsed.correctMapping,
    };
  }

  return {
    id: item.id,
    points: resolveQuestionPoints(item.points),
    parsedHtml: storedParsed,
    segments: item.segments,
    wordBank: item.wordBank,
    correctMapping: item.correctMapping,
  };
}

export type GroupedFillBlanksPlayerView = {
  taskInstruction: string;
  exampleText: string | null;
  items: GroupedFillBlanksPlayerItem[];
  isGrouped: boolean;
  mode: GroupedFillBlanksMode;
};

export function isGapFillPartialScoringQuestionType(
  type: string | null,
): boolean {
  return (
    type === "fill_in_the_blanks" ||
    type === "fill_in_the_blanks_multi" ||
    type === "fill_blanks_typing" ||
    type === "fill_blanks_typing_multi"
  );
}

export function isGapFillSingleTextQuestionType(type: string | null): boolean {
  return type === "fill_in_the_blanks" || type === "fill_blanks_typing";
}

export function isGapFillDndQuestionType(type: string | null): boolean {
  return (
    type === "fill_in_the_blanks" || type === "fill_in_the_blanks_multi"
  );
}

export function resolveGroupedFillBlanksMode(
  questionType: string | null,
): GroupedFillBlanksMode {
  if (questionType === "text_input") return "text_input";
  if (isGapFillDndQuestionType(questionType)) return "dnd";
  return "typing";
}

function dedupeBlankIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function blankIdsFromParsedHtml(parsedHtml: string | null | undefined): string[] {
  if (!parsedHtml?.trim()) return [];
  const ids: string[] = [];
  const re =
    /\bdata-blank-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(parsedHtml)) !== null) {
    const id = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (id) ids.push(id);
  }
  return dedupeBlankIds(ids);
}

/**
 * Blank IDs that the player must fill — single source, priority cascade (not a union).
 * 1. parsedHtml (what FillBlanksParsedHtmlQuestion renders)
 * 2. segments (legacy segment renderer)
 * 3. correctMapping keys
 */
export function resolveBlankIdsForGroupedFillBlanksItem(item: {
  segments: FillInTheBlanksSegment[];
  parsedHtml?: string | null;
  correctMapping: Record<string, string>;
}): string[] {
  const fromHtml = blankIdsFromParsedHtml(item.parsedHtml);
  if (fromHtml.length > 0) return fromHtml;

  const fromSegments = blankIdsFromSegments(item.segments);
  if (fromSegments.length > 0) return fromSegments;

  return Object.keys(item.correctMapping);
}

function countNonEmptyTypingAnswers(
  answers: Record<string, string>,
): number {
  return Object.values(answers).filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  ).length;
}

function countNonEmptyDndAssignments(
  answers: Record<string, string>,
  wordIds: Set<string>,
): number {
  return Object.entries(answers).filter(([, wordId]) => {
    return (
      typeof wordId === "string" &&
      wordId.length > 0 &&
      wordIds.has(wordId)
    );
  }).length;
}

export function countBlanksInGroupedFillBlanksItem(item: {
  segments: FillInTheBlanksSegment[];
  correctMapping: Record<string, string>;
  parsedHtml?: string | null;
}): number {
  const count = resolveBlankIdsForGroupedFillBlanksItem(item).length;
  return count > 0 ? count : 1;
}

function schemaForMode(mode: GroupedFillBlanksMode) {
  if (mode === "text_input") return groupedTextInputContentSchema;
  if (mode === "dnd") return groupedFillInTheBlanksContentSchema;
  return groupedFillBlanksContentSchema;
}

export function newGroupedFillBlanksId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `gfb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function extractExtraWordsFromFillContent(
  content: FillInTheBlanksContent,
): string[] {
  const usedCorrectWordIds = new Set(Object.values(content.correctMapping));
  return content.wordBank
    .filter((w) => !usedCorrectWordIds.has(w.id))
    .map((w) => w.text);
}

export function parseGroupedFillBlanksItemText(
  rawHtml: string,
  mode: GroupedFillBlanksMode,
  extraWords: string[] = [],
): Pick<
  GroupedFillBlanksItem,
  "segments" | "wordBank" | "correctMapping" | "parsedHtml"
> | null {
  const regex = /\[(.*?)\]/g;
  const matches = Array.from(rawHtml.matchAll(regex));

  const segments: FillInTheBlanksSegment[] = [];
  const wordBank: FillInTheBlanksWord[] = [];
  const correctMapping: Record<string, string> = {};
  let wordCounter = 1;

  const wordIdForText = (wordText: string): string => {
    const existing = wordBank.find((w) => w.text === wordText);
    if (existing) return existing.id;
    const wordId = `w-${wordCounter++}`;
    wordBank.push({ id: wordId, text: wordText });
    return wordId;
  };

  let parsedHtml = rawHtml;
  const forwardMatches: Array<{
    index: number;
    full: string;
    innerPlain: string;
    blankId: string;
  }> = [];

  for (const match of [...matches].reverse()) {
    const full = match[0]!;
    const index = match.index!;
    const innerPlain = stripHtmlTags(match[1] ?? "");
    const blankId = newBlankId();
    const placeholder = `<span data-blank-id="${blankId}" class="blank-placeholder"></span>`;
    parsedHtml =
      parsedHtml.slice(0, index) +
      placeholder +
      parsedHtml.slice(index + full.length);
    forwardMatches.unshift({ index, full, innerPlain, blankId });
  }

  let lastIndex = 0;
  for (const { index, full, innerPlain, blankId } of forwardMatches) {
    if (index > lastIndex) {
      segments.push({
        type: "text",
        value: rawHtml.slice(lastIndex, index),
      });
    }
    segments.push({ type: "blank", id: blankId });
    if (innerPlain) {
      correctMapping[blankId] = wordIdForText(innerPlain);
    }
    lastIndex = index + full.length;
  }

  if (lastIndex < rawHtml.length) {
    segments.push({
      type: "text",
      value: rawHtml.slice(lastIndex),
    });
  }

  if (mode === "dnd") {
    for (const w of extraWords) {
      const trimmed = w.trim();
      if (!trimmed || wordBank.some((x) => x.text === trimmed)) continue;
      wordBank.push({ id: `w-${wordCounter++}`, text: trimmed });
    }
  }

  const shuffledBank = mode === "dnd" ? shuffleInPlace(wordBank) : wordBank;
  const draft = {
    segments,
    wordBank: shuffledBank,
    correctMapping,
  };

  if (mode === "text_input") {
    const parsed = TextInputContentSchema.safeParse(draft);
    return parsed.success
      ? { ...parsed.data, parsedHtml }
      : null;
  }

  const parsed = FillInTheBlanksContentSchema.safeParse(draft);
  return parsed.success
    ? { ...parsed.data, parsedHtml }
    : null;
}

function fillContentToItemText(content: FillInTheBlanksContent): string {
  const wordById = new Map(content.wordBank.map((w) => [w.id, w.text]));
  let raw = "";
  for (const seg of content.segments) {
    if (seg.type === "text") {
      raw += seg.value;
    } else {
      const wid = content.correctMapping[seg.id];
      const txt = wid ? wordById.get(wid) : undefined;
      raw += txt ? `[${txt}]` : "[]";
    }
  }
  return raw;
}

export function buildLegacyGroupedFillItem(params: {
  text: string;
  points: number;
  content: FillInTheBlanksContent;
}): GroupedFillBlanksItem {
  return {
    id: LEGACY_GROUPED_FILL_ITEM_ID,
    text: params.text,
    points: resolveQuestionPoints(params.points),
    segments: params.content.segments,
    wordBank: params.content.wordBank,
    correctMapping: params.content.correctMapping,
  };
}

export function isGroupedFillBlanksContent(
  content: Json | null,
  mode: GroupedFillBlanksMode,
): boolean {
  const parsed = schemaForMode(mode).safeParse(content);
  return Boolean(parsed.success && parsed.data.items && parsed.data.items.length > 0);
}

export function parseGroupedFillBlanksItems(
  content: Json | null,
  mode: GroupedFillBlanksMode,
): GroupedFillBlanksItem[] | null {
  const parsed = schemaForMode(mode).safeParse(content);
  if (!parsed.success || !parsed.data.items?.length) {
    return null;
  }
  return parsed.data.items;
}

/** Сумма баллов за подзадания (без умножения на пропуски) — для `text_input`. */
export function sumGroupedFillBlanksItemPoints(
  items: GroupedFillBlanksItem[],
): number {
  return items.reduce(
    (sum, item) => sum + resolveQuestionPoints(item.points),
    0,
  );
}

/** Максимум баллов за пропуски: `points × число пропусков` на каждый item. */
export function sumGroupedFillBlanksPoints(items: GroupedFillBlanksItem[]): number {
  return items.reduce((sum, item) => {
    const unitPoints = resolveQuestionPoints(item.points);
    return sum + unitPoints * countBlanksInGroupedFillBlanksItem(item);
  }, 0);
}

export function resolveGroupedFillBlanksQuestionMaxPoints(params: {
  content: Json | null;
  questionType: string | null;
  questionPoints?: number | null;
}): number {
  if (params.questionType === "text_input") {
    const view = resolveGroupedFillBlanksPlayerView({
      content: params.content ?? {},
      questionType: params.questionType,
      questionPoints: params.questionPoints,
    });
    if (!view) return resolveQuestionPoints(params.questionPoints);
    return sumGroupedFillBlanksItemPoints(
      view.items.map((item) => ({
        id: item.id,
        text: "",
        points: item.points,
        segments: item.segments,
        wordBank: item.wordBank,
        correctMapping: item.correctMapping,
      })),
    );
  }

  if (!isGapFillPartialScoringQuestionType(params.questionType)) {
    return resolveQuestionPoints(params.questionPoints);
  }

  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content ?? {},
    questionType: params.questionType,
    questionPoints: params.questionPoints,
  });
  if (!view) return resolveQuestionPoints(params.questionPoints);

  return view.items.reduce((sum, item) => {
    return (
      sum +
      resolveQuestionPoints(item.points) *
        countBlanksInGroupedFillBlanksItem(item)
    );
  }, 0);
}

export function resolveGroupedFillBlanksPlayerView(params: {
  content: Json;
  questionType: string | null;
  questionPoints?: number | null;
}): GroupedFillBlanksPlayerView | null {
  const mode = resolveGroupedFillBlanksMode(params.questionType);
  const schema = schemaForMode(mode);
  const parsed = schema.safeParse(params.content);
  const taskInstruction = parsed.success ? parsed.data.text : "Вопрос";
  const exampleText =
    parsed.success && parsed.data.example_text?.trim()
      ? parsed.data.example_text.trim()
      : null;

  const groupedItems = parsed.success ? parsed.data.items : undefined;
  if (groupedItems && groupedItems.length > 0) {
    return {
      taskInstruction,
      exampleText,
      isGrouped: true,
      mode,
      items: groupedItems.map((item) => mapItemToPlayerItem(item, mode)),
    };
  }

  if (mode === "text_input") {
    const flatParsed = TextInputContentSchema.safeParse(params.content);
    if (!flatParsed.success) return null;
    const legacyItem = buildLegacyGroupedFillItem({
      text: fillContentToItemText(flatParsed.data),
      points: resolveQuestionPoints(params.questionPoints),
      content: flatParsed.data,
    });
    return {
      taskInstruction,
      exampleText,
      isGrouped: false,
      mode,
      items: [mapItemToPlayerItem(legacyItem, mode)],
    };
  }

  const flatParsed = FillInTheBlanksContentSchema.safeParse(params.content);
  if (!flatParsed.success) return null;

  const legacyItem = buildLegacyGroupedFillItem({
    text: fillContentToItemText(flatParsed.data),
    points: resolveQuestionPoints(params.questionPoints),
    content: flatParsed.data,
  });

  return {
    taskInstruction,
    exampleText,
    isGrouped: false,
    mode,
    items: [mapItemToPlayerItem(legacyItem, mode)],
  };
}

export function alignGroupedFillAnswersToPlayerItems(
  answers: Record<string, Record<string, string>>,
  items: { id: string }[],
): Record<string, Record<string, string>> {
  if (items.length === 0) return answers;

  const out: Record<string, Record<string, string>> = { ...answers };
  const legacy = out[LEGACY_GROUPED_FILL_ITEM_ID];

  if (items.length === 1) {
    const itemId = items[0]!.id;
    const current = out[itemId];
    if (legacy && (!current || Object.keys(current).length === 0)) {
      out[itemId] = legacy;
    }
  }

  return out;
}

export function unwrapAnswerDataJson(raw: Json | null): Json | null {
  if (raw == null) return null;
  let value: unknown = raw;
  let depth = 0;
  while (typeof value === "string" && depth < 3) {
    try {
      value = JSON.parse(value);
    } catch {
      return typeof value === "string" && value.trim() ? value : null;
    }
    depth++;
  }
  if (typeof value === "string") {
    return value.trim() ? value : null;
  }
  return value as Json;
}

export function hasGroupedFillTypingContent(
  grouped:
    | Record<string, Record<string, string> | string>
    | undefined
    | null,
): boolean {
  if (!grouped) return false;
  return Object.values(grouped).some((itemTyping) => {
    if (typeof itemTyping === "string") {
      return itemTyping.trim().length > 0;
    }
    if (!itemTyping || typeof itemTyping !== "object") return false;
    return Object.values(itemTyping).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
  });
}

export function mergeGroupedTypingRecords(
  ...sources: Array<Record<string, Record<string, string>> | undefined | null>
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [itemId, itemTyping] of Object.entries(source)) {
      if (typeof itemTyping === "string") {
        out[itemId] = { ...(out[itemId] ?? {}), "": itemTyping };
        continue;
      }
      if (!itemTyping || typeof itemTyping !== "object") continue;
      out[itemId] = { ...(out[itemId] ?? {}), ...itemTyping };
    }
  }
  return out;
}

export function firstNonEmptyTypingValue(
  itemTyping: Record<string, string> | null | undefined,
): string {
  if (!itemTyping) return "";
  for (const value of Object.values(itemTyping)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

const BRUTE_FORCE_TEXT_KEYS = ["text", "answer", "value"] as const;

/**
 * Агрессивно извлекает любую непустую строку из сырого answer_data
 * (строка, `{ text }`, `{ answer }`, вложенный groupedFillTyping и т.д.).
 */
export function bruteForceExtractTypingValue(
  source: unknown,
  blankId?: string,
  depth = 0,
): string {
  if (depth > 5) return "";

  if (typeof source === "string") {
    return source;
  }

  if (source == null || typeof source !== "object") {
    return "";
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = bruteForceExtractTypingValue(item, blankId, depth + 1);
      if (found.trim()) return found;
    }
    return "";
  }

  const rec = source as Record<string, unknown>;

  if (blankId && typeof rec[blankId] === "string") {
    const direct = rec[blankId];
    if (direct.trim()) return direct;
  }

  for (const key of BRUTE_FORCE_TEXT_KEYS) {
    const candidate = rec[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  const parsed = parseGroupedFillTypingFromAnswerData(rec as Json);
  if (parsed) {
    const flat: Record<string, string> = {};
    for (const itemTyping of Object.values(parsed)) {
      if (typeof itemTyping === "string") {
        const text = itemTyping as string;
        if (text.trim()) return text;
      }
      if (itemTyping && typeof itemTyping === "object") {
        Object.assign(flat, itemTyping);
      }
    }
    if (
      blankId &&
      typeof flat[blankId] === "string" &&
      flat[blankId]!.trim()
    ) {
      return flat[blankId]!;
    }
    const pooled = firstNonEmptyTypingValue(flat);
    if (pooled) return pooled;
  }

  for (const value of Object.values(rec)) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  for (const value of Object.values(rec)) {
    if (value && typeof value === "object") {
      const nested = bruteForceExtractTypingValue(value, blankId, depth + 1);
      if (nested.trim()) return nested;
    }
  }

  return "";
}

/** Значение для readonly-поля в review: нормализация + brute-force по сырому ответу. */
export function resolveReviewDisplayTypingValue(params: {
  rawValue: unknown;
  assignments: Record<string, string>;
  blankId: string;
  blankIds: string[];
}): string {
  const fromAssignments = resolveTypingValueForBlank(
    params.assignments,
    params.blankId,
    params.blankIds,
  );
  if (fromAssignments.trim()) return fromAssignments;

  const fromRaw = bruteForceExtractTypingValue(params.rawValue, params.blankId);
  if (fromRaw.trim()) return fromRaw;

  if (typeof params.rawValue === "string") {
    return params.rawValue;
  }

  if (
    params.rawValue &&
    typeof params.rawValue === "object" &&
    !Array.isArray(params.rawValue)
  ) {
    const rec = params.rawValue as Record<string, unknown>;
    if (params.blankId && typeof rec[params.blankId] === "string") {
      return rec[params.blankId] as string;
    }
    const fallbackVal = Object.values(rec).find(
      (value) => typeof value === "string" && value.trim() !== "",
    );
    if (typeof fallbackVal === "string") return fallbackVal;
  }

  return "";
}

/** Приводит ответ подзадания к ключам blank id из контента (строка, устаревшие id, один пропуск). */
export function normalizeItemTypingForBlanks(
  itemTyping: Record<string, string> | string | null | undefined,
  blankIds: string[],
): Record<string, string> {
  if (itemTyping == null) return {};

  if (typeof itemTyping === "string") {
    if (!itemTyping.trim()) return {};
    if (blankIds.length >= 1) {
      return { [blankIds[0]!]: itemTyping };
    }
    return { "": itemTyping };
  }

  const byKey: Record<string, string> = {};
  for (const [key, value] of Object.entries(itemTyping)) {
    if (typeof value === "string") {
      byKey[key] = value;
    }
  }

  const nonEmptyValues = Object.values(byKey).filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  if (blankIds.length === 0) {
    return byKey;
  }

  const hasMatchingKey = blankIds.some(
    (id) => typeof byKey[id] === "string" && byKey[id]!.trim().length > 0,
  );
  if (hasMatchingKey) return byKey;

  if (blankIds.length === 1 && nonEmptyValues.length > 0) {
    return { [blankIds[0]!]: nonEmptyValues.join("\n") };
  }

  if (
    nonEmptyValues.length === blankIds.length &&
    nonEmptyValues.length > 0
  ) {
    return Object.fromEntries(
      blankIds.map((id, index) => [id, nonEmptyValues[index]!] as const),
    );
  }

  if (nonEmptyValues.length === 1 && blankIds.length >= 1) {
    return { [blankIds[0]!]: nonEmptyValues[0]! };
  }

  return byKey;
}

/** Безопасно достаёт текст пропуска даже при несовпадении ключей в сохранённом ответе. */
export function resolveTypingValueForBlank(
  assignments: Record<string, string>,
  blankId: string,
  blankIds: string[],
): string {
  const normalized = normalizeItemTypingForBlanks(assignments, blankIds);
  const fromNormalized = normalized[blankId];
  if (typeof fromNormalized === "string" && fromNormalized.length > 0) {
    return fromNormalized;
  }

  const direct = assignments[blankId];
  if (typeof direct === "string") return direct;

  if (blankIds.length === 1) {
    const pooled = firstNonEmptyTypingValue({
      ...assignments,
      ...normalized,
    });
    if (pooled) return pooled;
  }

  const blankIndex = blankIds.indexOf(blankId);
  if (blankIndex >= 0) {
    const orderedValues = Object.values(normalized).filter(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
    if (blankIndex < orderedValues.length) {
      return orderedValues[blankIndex]!;
    }
  }

  return firstNonEmptyTypingValue(assignments);
}

export function normalizeGroupedTypingForPlayerItems(
  groupedTyping: Record<string, Record<string, string>>,
  items: GroupedFillBlanksPlayerItem[],
): Record<string, Record<string, string>> {
  const aligned = alignGroupedFillAnswersToPlayerItems(
    groupedTyping,
    items.map((item) => ({ id: item.id })),
  );

  if (items.length === 1) {
    const item = items[0]!;
    const pool: Record<string, string> = {};
    for (const itemTyping of Object.values(aligned)) {
      if (itemTyping && typeof itemTyping === "object") {
        Object.assign(pool, itemTyping);
      }
    }
    const legacy = aligned[LEGACY_GROUPED_FILL_ITEM_ID];
    if (legacy && typeof legacy === "object") {
      Object.assign(pool, legacy);
    }
    const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
    return {
      [item.id]: normalizeItemTypingForBlanks(pool, blankIds),
    };
  }

  const out: Record<string, Record<string, string>> = {};
  for (const item of items) {
    const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
    const raw =
      aligned[item.id] ??
      (items.length === 1 ? aligned[LEGACY_GROUPED_FILL_ITEM_ID] : undefined);
    out[item.id] = normalizeItemTypingForBlanks(raw, blankIds);
  }

  return out;
}

export function resolveReviewGroupedFillTypingForPlayer(params: {
  rows: { answer_data: Json | null }[];
  fromMap?: Record<string, Record<string, string>>;
  items: GroupedFillBlanksPlayerItem[];
}): Record<string, Record<string, string>> {
  let saved = hasGroupedFillTypingContent(params.fromMap)
    ? { ...params.fromMap! }
    : {};

  for (const row of params.rows) {
    const parsed = parseGroupedFillTypingFromAnswerData(
      unwrapAnswerDataJson(row.answer_data),
    );
    if (parsed) {
      saved = mergeGroupedTypingRecords(saved, parsed);
    }
  }

  let normalized = normalizeGroupedTypingForPlayerItems(saved, params.items);

  if (!hasGroupedFillTypingContent(normalized)) {
    const brute: Record<string, Record<string, string>> = {};
    for (const item of params.items) {
      const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
      for (const row of params.rows) {
        const raw = unwrapAnswerDataJson(row.answer_data);
        const text = bruteForceExtractTypingValue(raw);
        if (!text.trim()) continue;
        brute[item.id] = normalizeItemTypingForBlanks(text, blankIds);
        break;
      }
    }
    if (hasGroupedFillTypingContent(brute)) {
      normalized = normalizeGroupedTypingForPlayerItems(
        mergeGroupedTypingRecords(saved, brute),
        params.items,
      );
    }
  }

  return normalized;
}

export function parseGroupedFillAssignmentsFromAnswerData(
  data: Json | null,
): Record<string, Record<string, string>> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const grouped = rec.groupedFillAssignments;
  if (grouped && typeof grouped === "object" && !Array.isArray(grouped)) {
    const out: Record<string, Record<string, string>> = {};
    for (const [itemId, blanks] of Object.entries(grouped)) {
      if (!blanks || typeof blanks !== "object" || Array.isArray(blanks)) {
        return null;
      }
      const itemOut: Record<string, string> = {};
      for (const [blankId, wordId] of Object.entries(blanks)) {
        if (typeof wordId !== "string") return null;
        itemOut[blankId] = wordId;
      }
      out[itemId] = itemOut;
    }
    return out;
  }

  const legacy = parseFillAssignmentsFromAnswerData(data);
  if (legacy) {
    return { [LEGACY_GROUPED_FILL_ITEM_ID]: legacy };
  }

  return null;
}

export function parseGroupedFillTypingFromAnswerData(
  data: Json | null,
): Record<string, Record<string, string>> | null {
  if (typeof data === "string" && data.trim()) {
    return { [LEGACY_GROUPED_FILL_ITEM_ID]: { "": data } };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;

  for (const key of ["text", "answer", "value"] as const) {
    const candidate = rec[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return { [LEGACY_GROUPED_FILL_ITEM_ID]: { "": candidate } };
    }
  }

  const grouped = rec.groupedFillTyping;
  if (grouped && typeof grouped === "object" && !Array.isArray(grouped)) {
    const out: Record<string, Record<string, string>> = {};
    for (const [itemId, blanks] of Object.entries(grouped)) {
      if (typeof blanks === "string") {
        out[itemId] = { "": blanks };
        continue;
      }
      if (!blanks || typeof blanks !== "object" || Array.isArray(blanks)) {
        return null;
      }
      const itemOut: Record<string, string> = {};
      for (const [blankId, value] of Object.entries(blanks)) {
        if (typeof value !== "string") return null;
        itemOut[blankId] = value;
      }
      out[itemId] = itemOut;
    }
    return out;
  }

  const legacy = parseFillTypingFromAnswerData(data);
  if (legacy) {
    return { [LEGACY_GROUPED_FILL_ITEM_ID]: legacy };
  }

  return null;
}

export function countCorrectDnDBlanksInItem(
  item: GroupedFillBlanksPlayerItem,
  itemAssignments: Record<string, string>,
): number {
  const idsToCheck = resolveBlankIdsForGroupedFillBlanksItem(item);
  if (idsToCheck.length === 0) return 0;
  const wordIds = new Set(item.wordBank.map((w) => w.id));
  let correct = 0;
  for (const blankId of idsToCheck) {
    const expectedWordId = item.correctMapping[blankId];
    const assignedWordId = itemAssignments[blankId];
    if (!expectedWordId || !assignedWordId) continue;
    if (!wordIds.has(assignedWordId)) continue;
    if (assignedWordId === expectedWordId) correct += 1;
  }
  return correct;
}

export function countCorrectTypingBlanksInItem(
  item: GroupedFillBlanksPlayerItem,
  itemTyping: Record<string, string>,
): number {
  const itemContent: FillInTheBlanksContent = {
    segments: item.segments,
    wordBank: item.wordBank,
    correctMapping: item.correctMapping,
  };
  const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
  if (blankIds.length === 0) return 0;
  let correct = 0;
  for (const blankId of blankIds) {
    const expected = correctTextForBlank(itemContent, blankId);
    if (expected == null) continue;
    const typed = itemTyping[blankId];
    if (
      typeof typed === "string" &&
      isFillBlankTypingAnswerCorrect(typed, expected)
    ) {
      correct += 1;
    }
  }
  return correct;
}

export function scoreGroupedFillInTheBlanksQuestion(params: {
  content: Json | null;
  questionType: string | null;
  groupedAssignments: Record<string, Record<string, string>>;
  questionPoints?: number | null;
}): number {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content ?? {},
    questionType: params.questionType,
    questionPoints: params.questionPoints,
  });
  if (!view || view.mode !== "dnd") return 0;

  return view.items.reduce((sum, item) => {
    const itemAssignments = params.groupedAssignments[item.id] ?? {};
    const correctBlanks = countCorrectDnDBlanksInItem(item, itemAssignments);
    return sum + correctBlanks * resolveQuestionPoints(item.points);
  }, 0);
}

export function scoreGroupedFillBlanksTypingQuestion(params: {
  content: Json | null;
  questionType: string | null;
  groupedTyping: Record<string, Record<string, string>>;
  questionPoints?: number | null;
}): number {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content ?? {},
    questionType: params.questionType,
    questionPoints: params.questionPoints,
  });
  if (!view || view.mode !== "typing") return 0;

  return view.items.reduce((sum, item) => {
    const itemTyping = params.groupedTyping[item.id] ?? {};
    const correctBlanks = countCorrectTypingBlanksInItem(item, itemTyping);
    return sum + correctBlanks * resolveQuestionPoints(item.points);
  }, 0);
}

function isGroupedFillBlanksDndItemComplete(
  item: GroupedFillBlanksPlayerItem,
  itemAssignments: Record<string, string>,
): boolean {
  const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
  if (blankIds.length === 0) return false;

  const wordIds = new Set(item.wordBank.map((w) => w.id));
  const everyBlankFilled = blankIds.every((id) => {
    const wordId = itemAssignments[id];
    return (
      typeof wordId === "string" && wordId.length > 0 && wordIds.has(wordId)
    );
  });
  if (everyBlankFilled) return true;

  const filledCount = countNonEmptyDndAssignments(itemAssignments, wordIds);
  return filledCount === blankIds.length;
}

function isGroupedFillBlanksTypingItemComplete(
  item: GroupedFillBlanksPlayerItem,
  itemTyping: Record<string, string>,
): boolean {
  const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
  if (blankIds.length === 0) return false;

  const everyBlankFilled = blankIds.every(
    (id) => (itemTyping[id] ?? "").trim().length > 0,
  );
  if (everyBlankFilled) return true;

  const filledCount = countNonEmptyTypingAnswers(itemTyping);
  return filledCount === blankIds.length;
}

export function isGroupedFillAssignmentsComplete(
  view: GroupedFillBlanksPlayerView,
  groupedAssignments: Record<string, Record<string, string>>,
): boolean {
  if (view.mode !== "dnd" || view.items.length === 0) return false;
  return view.items.every((item) =>
    isGroupedFillBlanksDndItemComplete(
      item,
      groupedAssignments[item.id] ?? {},
    ),
  );
}

export function isGroupedFillBlanksSelectionComplete(
  view: GroupedFillBlanksPlayerView,
  groupedTyping: Record<string, Record<string, string>>,
): boolean {
  if (view.mode === "dnd") return false;
  if (view.items.length === 0) return false;
  return view.items.every((item) =>
    isGroupedFillBlanksTypingItemComplete(
      item,
      groupedTyping[item.id] ?? {},
    ),
  );
}

export function isGroupedFillBlanksTaskComplete(
  view: GroupedFillBlanksPlayerView,
  draft: {
    groupedFillAssignments: Record<string, Record<string, string>>;
    groupedFillTyping: Record<string, Record<string, string>>;
  },
): boolean {
  if (view.items.length === 0) return false;
  return view.mode === "dnd"
    ? isGroupedFillAssignmentsComplete(view, draft.groupedFillAssignments)
    : isGroupedFillBlanksSelectionComplete(view, draft.groupedFillTyping);
}

export function isGroupedFillInTheBlanksFullyCorrect(params: {
  content: Json | null;
  questionType: string | null;
  groupedAssignments: Record<string, Record<string, string>>;
  questionPoints?: number | null;
}): boolean {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content ?? {},
    questionType: params.questionType,
    questionPoints: params.questionPoints,
  });
  if (!view || view.mode !== "dnd") return false;

  const earned = scoreGroupedFillInTheBlanksQuestion({
    content: params.content,
    questionType: params.questionType,
    groupedAssignments: params.groupedAssignments,
    questionPoints: params.questionPoints,
  });
  const total = view.items.reduce(
    (sum, item) =>
      sum +
      resolveQuestionPoints(item.points) *
        countBlanksInGroupedFillBlanksItem(item),
    0,
  );
  return earned >= total && total > 0;
}

export function isGroupedFillBlanksFullyCorrect(params: {
  content: Json | null;
  questionType: string | null;
  groupedTyping: Record<string, Record<string, string>>;
  questionPoints?: number | null;
}): boolean {
  const view = resolveGroupedFillBlanksPlayerView({
    content: params.content ?? {},
    questionType: params.questionType,
    questionPoints: params.questionPoints,
  });
  if (!view || view.mode !== "typing") return false;

  const earned = scoreGroupedFillBlanksTypingQuestion({
    content: params.content,
    questionType: params.questionType,
    groupedTyping: params.groupedTyping,
    questionPoints: params.questionPoints,
  });
  const total = view.items.reduce(
    (sum, item) =>
      sum +
      resolveQuestionPoints(item.points) *
        countBlanksInGroupedFillBlanksItem(item),
    0,
  );
  return earned >= total && total > 0;
}
