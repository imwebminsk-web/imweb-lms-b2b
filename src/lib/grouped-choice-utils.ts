import {
  GROUPED_CHOICE_ANCHOR_TEXT,
  groupedChoiceContentSchema,
  LEGACY_GROUPED_ITEM_ID,
  type GroupedChoiceItem,
} from "@/lib/validations/grouped-choice-schema";
import { resolveQuestionPoints } from "@/lib/utils/grading";
import type { Json } from "@/types/database.types";

export {
  GROUPED_CHOICE_ANCHOR_TEXT,
  LEGACY_GROUPED_ITEM_ID,
} from "@/lib/validations/grouped-choice-schema";

export type GroupedChoicePlayerOption = {
  id: string;
  text: string;
  image_url?: string;
};

export type GroupedChoicePlayerItem = {
  id: string;
  text: string;
  points: number;
  options: GroupedChoicePlayerOption[];
};

export type GroupedChoicePlayerView = {
  taskInstruction: string;
  exampleText: string | null;
  items: GroupedChoicePlayerItem[];
  isGrouped: boolean;
};

export function newGroupedChoiceId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isGroupedChoiceContent(content: Json | null): boolean {
  const parsed = groupedChoiceContentSchema.safeParse(content);
  return parsed.success && Array.isArray(parsed.data.items) && parsed.data.items.length > 0;
}

export function parseGroupedChoiceItems(content: Json | null): GroupedChoiceItem[] | null {
  const parsed = groupedChoiceContentSchema.safeParse(content);
  if (!parsed.success || !parsed.data.items?.length) {
    return null;
  }
  return parsed.data.items;
}

export function sumGroupedItemPoints(items: GroupedChoiceItem[]): number {
  return items.reduce((sum, item) => sum + resolveQuestionPoints(item.points), 0);
}

export function buildLegacyGroupedItem(params: {
  text: string;
  points: number;
  options: {
    id: string;
    text: string;
    is_correct: boolean | null;
    image_url?: string;
  }[];
}): GroupedChoiceItem {
  return {
    id: LEGACY_GROUPED_ITEM_ID,
    text: params.text,
    points: resolveQuestionPoints(params.points),
    options: params.options.map((o) => ({
      id: o.id,
      text: o.text,
      is_correct: Boolean(o.is_correct),
      ...(o.image_url?.trim() ? { image_url: o.image_url.trim() } : {}),
    })),
  };
}

function mapChoiceOptionForPlayer(o: {
  id: string;
  text: string;
  image_url?: string;
}): GroupedChoicePlayerOption {
  return {
    id: o.id,
    text: o.text,
    ...(o.image_url?.trim() ? { image_url: o.image_url.trim() } : {}),
  };
}

export function resolveGroupedChoicePlayerView(params: {
  content: Json;
  questionType: string | null;
  legacyOptions?: { id: string; content: Json; is_correct?: boolean | null }[];
  questionPoints?: number | null;
}): GroupedChoicePlayerView {
  const parsed = groupedChoiceContentSchema.safeParse(params.content);
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
      items: groupedItems.map((item) => ({
        id: item.id,
        text: item.text,
        points: resolveQuestionPoints(item.points),
        options: item.options.map((o) => mapChoiceOptionForPlayer(o)),
      })),
    };
  }

  const legacyOpts = (params.legacyOptions ?? []).filter((o) => {
    const rec = o.content as { text?: unknown };
    return rec.text !== GROUPED_CHOICE_ANCHOR_TEXT;
  });

  const legacyItem = buildLegacyGroupedItem({
    text: taskInstruction,
    points: resolveQuestionPoints(params.questionPoints),
    options: legacyOpts.map((o) => {
      const rec = o.content as { text?: unknown; image_url?: unknown };
      return {
        id: o.id,
        text: typeof rec.text === "string" ? rec.text : "",
        is_correct: o.is_correct ?? false,
        ...(typeof rec.image_url === "string" && rec.image_url.trim()
          ? { image_url: rec.image_url.trim() }
          : {}),
      };
    }),
  });

  return {
    taskInstruction,
    exampleText,
    isGrouped: false,
    items: [
      {
        id: legacyItem.id,
        text: legacyItem.text,
        points: legacyItem.points,
        options: legacyItem.options.map((o) => mapChoiceOptionForPlayer(o)),
      },
    ],
  };
}

export function sanitizeGroupedChoiceContentForClient(content: Json): Json {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return content;
  }
  const rec = content as Record<string, unknown>;
  const items = rec.items;
  if (!Array.isArray(items)) {
    return content;
  }
  return {
    ...rec,
    items: items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return item;
      }
      const itemRec = item as Record<string, unknown>;
      const options = itemRec.options;
      if (!Array.isArray(options)) {
        return item;
      }
      return {
        ...itemRec,
        options: options.map((opt) => {
          if (!opt || typeof opt !== "object" || Array.isArray(opt)) {
            return opt;
          }
          const { is_correct: _removed, ...rest } = opt as Record<string, unknown>;
          return rest;
        }),
      };
    }),
  } as Json;
}

export function parseGroupedSelectionsFromAnswerData(
  data: Json | null,
): Record<string, string[]> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const grouped = rec.groupedSelections;
  if (!grouped || typeof grouped !== "object" || Array.isArray(grouped)) {
    return null;
  }
  const out: Record<string, string[]> = {};
  for (const [itemId, raw] of Object.entries(grouped)) {
    if (!Array.isArray(raw)) return null;
    const ids = raw.filter((v): v is string => typeof v === "string");
    if (ids.length !== raw.length) return null;
    out[itemId] = ids;
  }
  return out;
}

export function correctOptionIdsForGroupedItem(item: GroupedChoiceItem): string[] {
  return item.options.filter((o) => o.is_correct).map((o) => o.id);
}

export function isGroupedItemAnswerCorrect(
  item: GroupedChoiceItem,
  selectedIds: string[],
  questionType: string | null,
): boolean {
  const correct = correctOptionIdsForGroupedItem(item);
  const uniqueSelected = [...new Set(selectedIds)];
  const isMultiple =
    questionType === "multiple_choice" || questionType === "multiple";

  if (isMultiple) {
    const a = [...new Set(correct)].sort();
    const b = [...new Set(uniqueSelected)].sort();
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  return uniqueSelected.length === 1 && correct.includes(uniqueSelected[0]!);
}

export function scoreGroupedChoiceQuestion(params: {
  content: Json | null;
  questionType: string | null;
  selections: Record<string, string[]>;
  legacyOptions?: { id: string; content: Json; is_correct?: boolean | null }[];
  questionPoints?: number | null;
}): number {
  const items = parseGroupedChoiceItems(params.content);
  const resolvedItems =
    items ??
    (params.legacyOptions
      ? [
          buildLegacyGroupedItem({
            text: "",
            points: resolveQuestionPoints(params.questionPoints),
            options: params.legacyOptions
              .filter((o) => {
                const rec = o.content as { text?: unknown };
                return rec.text !== GROUPED_CHOICE_ANCHOR_TEXT;
              })
              .map((o) => {
                const rec = o.content as { text?: unknown; image_url?: unknown };
                return {
                  id: o.id,
                  text: typeof rec.text === "string" ? rec.text : "",
                  is_correct: o.is_correct ?? false,
                  ...(typeof rec.image_url === "string" && rec.image_url.trim()
                    ? { image_url: rec.image_url.trim() }
                    : {}),
                };
              }),
          }),
        ]
      : null);

  if (!resolvedItems) return 0;

  let earned = 0;
  for (const item of resolvedItems) {
    const selected = params.selections[item.id] ?? [];
    if (isGroupedItemAnswerCorrect(item, selected, params.questionType)) {
      earned += resolveQuestionPoints(item.points);
    }
  }
  return earned;
}

export function groupedCorrectMapFromContent(
  content: Json | null,
): Record<string, string[]> | null {
  const items = parseGroupedChoiceItems(content);
  if (!items) return null;
  const out: Record<string, string[]> = {};
  for (const item of items) {
    out[item.id] = correctOptionIdsForGroupedItem(item);
  }
  return out;
}

export function isGroupedChoiceQuestionFullyCorrect(params: {
  content: Json | null;
  questionType: string | null;
  selections: Record<string, string[]>;
  questionPoints?: number | null;
}): boolean {
  const earned = scoreGroupedChoiceQuestion({
    content: params.content,
    questionType: params.questionType,
    selections: params.selections,
    questionPoints: params.questionPoints,
  });
  const items = parseGroupedChoiceItems(params.content);
  const total = items
    ? sumGroupedItemPoints(items)
    : resolveQuestionPoints(params.questionPoints);
  return earned > 0 && earned >= total;
}
