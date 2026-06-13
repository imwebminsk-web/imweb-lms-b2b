import { parseFillInTheBlanks } from "@/lib/fill-in-the-blanks-parser";
import { isFillBlanksTypingFullyCorrect } from "@/lib/fill-blanks-scoring";
import {
  parseFillAssignmentsFromAnswerData,
  parseFillTypingFromAnswerData,
} from "@/lib/quiz-helpers";
import { resolveQuestionPoints } from "@/lib/utils/grading";
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

export {
  GROUPED_FILL_BLANKS_ANCHOR_TEXT,
  LEGACY_GROUPED_FILL_ITEM_ID,
} from "@/lib/validations/grouped-fill-blanks-schema";

export type GroupedFillBlanksMode = "dnd" | "typing" | "text_input";

export type GroupedFillBlanksPlayerItem = {
  id: string;
  points: number;
  segments: FillInTheBlanksSegment[];
  wordBank: FillInTheBlanksWord[];
  correctMapping: Record<string, string>;
};

export type GroupedFillBlanksPlayerView = {
  taskInstruction: string;
  exampleText: string | null;
  items: GroupedFillBlanksPlayerItem[];
  isGrouped: boolean;
  mode: GroupedFillBlanksMode;
};

export function resolveGroupedFillBlanksMode(
  questionType: string | null,
): GroupedFillBlanksMode {
  if (questionType === "text_input") return "text_input";
  if (questionType === "fill_in_the_blanks") return "dnd";
  return "typing";
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
  rawText: string,
  mode: GroupedFillBlanksMode,
  extraWords: string[] = [],
): Pick<
  GroupedFillBlanksItem,
  "segments" | "wordBank" | "correctMapping"
> | null {
  const draft = parseFillInTheBlanks(rawText, mode === "dnd" ? extraWords : []);
  if (mode === "text_input") {
    const parsed = TextInputContentSchema.safeParse(draft);
    return parsed.success
      ? {
          segments: parsed.data.segments,
          wordBank: parsed.data.wordBank,
          correctMapping: parsed.data.correctMapping,
        }
      : null;
  }
  const parsed = FillInTheBlanksContentSchema.safeParse(draft);
  return parsed.success
    ? {
        segments: parsed.data.segments,
        wordBank: parsed.data.wordBank,
        correctMapping: parsed.data.correctMapping,
      }
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

export function sumGroupedFillBlanksPoints(items: GroupedFillBlanksItem[]): number {
  return items.reduce(
    (sum, item) => sum + resolveQuestionPoints(item.points),
    0,
  );
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
      items: groupedItems.map((item) => ({
        id: item.id,
        points: resolveQuestionPoints(item.points),
        segments: item.segments,
        wordBank: item.wordBank,
        correctMapping: item.correctMapping,
      })),
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
      items: [
        {
          id: legacyItem.id,
          points: legacyItem.points,
          segments: legacyItem.segments,
          wordBank: legacyItem.wordBank,
          correctMapping: legacyItem.correctMapping,
        },
      ],
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
    items: [
      {
        id: legacyItem.id,
        points: legacyItem.points,
        segments: legacyItem.segments,
        wordBank: legacyItem.wordBank,
        correctMapping: legacyItem.correctMapping,
      },
    ],
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

function isFillInTheBlanksItemFullyCorrect(
  item: GroupedFillBlanksPlayerItem,
  itemAssignments: Record<string, string>,
): boolean {
  const blankIds = blankIdsFromSegments(item.segments);
  if (blankIds.length === 0) return false;
  const wordIds = new Set(item.wordBank.map((w) => w.id));
  return blankIds.every((blankId) => {
    const expectedWordId = item.correctMapping[blankId];
    const assignedWordId = itemAssignments[blankId];
    if (!expectedWordId || !assignedWordId) return false;
    if (!wordIds.has(assignedWordId)) return false;
    return assignedWordId === expectedWordId;
  });
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
    if (isFillInTheBlanksItemFullyCorrect(item, itemAssignments)) {
      return sum + resolveQuestionPoints(item.points);
    }
    return sum;
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
    const itemContent: FillInTheBlanksContent = {
      segments: item.segments,
      wordBank: item.wordBank,
      correctMapping: item.correctMapping,
    };
    if (isFillBlanksTypingFullyCorrect(itemContent, itemTyping)) {
      return sum + resolveQuestionPoints(item.points);
    }
    return sum;
  }, 0);
}

export function isGroupedFillAssignmentsComplete(
  view: GroupedFillBlanksPlayerView,
  groupedAssignments: Record<string, Record<string, string>>,
): boolean {
  if (view.mode !== "dnd" || view.items.length === 0) return false;
  return view.items.every((item) => {
    const blankIds = blankIdsFromSegments(item.segments);
    if (blankIds.length === 0) return false;
    const wordIds = new Set(item.wordBank.map((w) => w.id));
    const itemAssignments = groupedAssignments[item.id] ?? {};
    return blankIds.every((id) => {
      const wid = itemAssignments[id];
      return typeof wid === "string" && wordIds.has(wid);
    });
  });
}

export function isGroupedFillBlanksSelectionComplete(
  view: GroupedFillBlanksPlayerView,
  groupedTyping: Record<string, Record<string, string>>,
): boolean {
  if (view.mode === "dnd") return false;
  if (view.items.length === 0) return false;
  return view.items.every((item) => {
    const blankIds = blankIdsFromSegments(item.segments);
    if (blankIds.length === 0) return false;
    const itemTyping = groupedTyping[item.id] ?? {};
    return blankIds.every((id) => (itemTyping[id] ?? "").length > 0);
  });
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
    (sum, item) => sum + resolveQuestionPoints(item.points),
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
    (sum, item) => sum + resolveQuestionPoints(item.points),
    0,
  );
  return earned >= total && total > 0;
}
