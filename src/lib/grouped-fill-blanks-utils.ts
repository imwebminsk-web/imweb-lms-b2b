import {
  correctTextForBlank,
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

  return {
    id: item.id,
    points: resolveQuestionPoints(item.points),
    parsedHtml: storedParsed ?? reparsed?.parsedHtml ?? null,
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

function blankIdsFromParsedHtml(parsedHtml: string | null | undefined): string[] {
  if (!parsedHtml?.trim()) return [];
  const ids: string[] = [];
  const re = /data-blank-id=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(parsedHtml)) !== null) {
    const id = match[1];
    if (id) ids.push(id);
  }
  return ids;
}

/** Blank IDs for validation: parsed HTML (player UI) → segments → correctMapping. */
export function resolveBlankIdsForGroupedFillBlanksItem(item: {
  segments: FillInTheBlanksSegment[];
  parsedHtml?: string | null;
  correctMapping: Record<string, string>;
}): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of blankIdsFromParsedHtml(item.parsedHtml)) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of blankIdsFromSegments(item.segments)) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of Object.keys(item.correctMapping)) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }

  return ordered;
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
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const grouped = rec.groupedFillTyping;
  if (grouped && typeof grouped === "object" && !Array.isArray(grouped)) {
    const out: Record<string, Record<string, string>> = {};
    for (const [itemId, blanks] of Object.entries(grouped)) {
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

function countCorrectDnDBlanksInItem(
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

function countCorrectTypingBlanksInItem(
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
    if (typeof typed === "string" && typed === expected) correct += 1;
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
  return blankIds.every((id) => {
    const wid = itemAssignments[id];
    return typeof wid === "string" && wid.length > 0 && wordIds.has(wid);
  });
}

function isGroupedFillBlanksTypingItemComplete(
  item: GroupedFillBlanksPlayerItem,
  itemTyping: Record<string, string>,
): boolean {
  const blankIds = resolveBlankIdsForGroupedFillBlanksItem(item);
  if (blankIds.length === 0) return false;
  return blankIds.every((id) => (itemTyping[id] ?? "").trim().length > 0);
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
