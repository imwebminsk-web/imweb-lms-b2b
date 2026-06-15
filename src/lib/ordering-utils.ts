import {
  GROUPED_ORDERING_ANCHOR_TEXT,
  orderingContentSchema,
  type OrderingItem,
} from "@/lib/validations/ordering-schema";
import { resolveQuestionPoints } from "@/lib/utils/grading";
import type { Json } from "@/types/database.types";

export { GROUPED_ORDERING_ANCHOR_TEXT } from "@/lib/validations/ordering-schema";

export type OrderingPlayerElement = {
  id: string;
  text: string;
};

export type OrderingPlayerItem = {
  id: string;
  text: string;
  points: number;
  elements: OrderingPlayerElement[];
};

export type OrderingPlayerView = {
  taskInstruction: string;
  exampleText: string | null;
  items: OrderingPlayerItem[];
  isGrouped: boolean;
};

export function newOrderingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function shuffleOrderingIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

export function isGroupedOrderingContent(content: Json | null): boolean {
  const parsed = orderingContentSchema.safeParse(content);
  return Boolean(parsed.success && parsed.data.items && parsed.data.items.length > 0);
}

export function parseOrderingItems(content: Json | null): OrderingItem[] | null {
  const parsed = orderingContentSchema.safeParse(content);
  if (!parsed.success || !parsed.data.items?.length) {
    return null;
  }
  return parsed.data.items;
}

export function sumOrderingItemPoints(items: OrderingItem[]): number {
  return items.reduce((sum, item) => sum + resolveQuestionPoints(item.points), 0);
}

export function correctElementOrderForItem(item: OrderingItem): string[] {
  return item.elements.map((el) => el.id);
}

export function groupedCorrectOrderingMapFromContent(
  content: Json | null,
): Record<string, string[]> | null {
  const items = parseOrderingItems(content);
  if (!items) return null;
  const out: Record<string, string[]> = {};
  for (const item of items) {
    out[item.id] = correctElementOrderForItem(item);
  }
  return out;
}

export function resolveOrderingPlayerView(params: {
  content: Json;
  questionPoints?: number | null;
}): OrderingPlayerView | null {
  const parsed = orderingContentSchema.safeParse(params.content);
  if (!parsed.success) return null;

  const taskInstruction = parsed.data.text;
  const exampleText =
    parsed.data.example_text?.trim() ? parsed.data.example_text.trim() : null;

  const groupedItems = parsed.data.items;
  if (groupedItems && groupedItems.length > 0) {
    return {
      taskInstruction,
      exampleText,
      isGrouped: true,
      items: groupedItems.map((item) => ({
        id: item.id,
        text: item.text ?? "",
        points: resolveQuestionPoints(item.points),
        elements: item.elements.map((el) => ({ id: el.id, text: el.text })),
      })),
    };
  }

  return null;
}

export function parseOrderingAssignmentsFromAnswerData(
  data: Json | null,
): Record<string, string[]> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const grouped = rec.orderingAssignments;
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

export function isOrderingItemAnswerCorrect(
  item: OrderingItem,
  submittedOrder: string[],
): boolean {
  const correct = correctElementOrderForItem(item);
  if (submittedOrder.length !== correct.length) return false;
  return submittedOrder.every((id, i) => id === correct[i]);
}

export function scoreOrderingQuestion(params: {
  content: Json | null;
  assignments: Record<string, string[]>;
}): number {
  const items = parseOrderingItems(params.content);
  if (!items) return 0;

  return items.reduce((sum, item) => {
    const submitted = params.assignments[item.id];
    if (!submitted) return sum;
    if (isOrderingItemAnswerCorrect(item, submitted)) {
      return sum + resolveQuestionPoints(item.points);
    }
    return sum;
  }, 0);
}

export function isOrderingAssignmentsComplete(
  items: OrderingPlayerItem[],
  assignments: Record<string, string[]>,
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => {
    const order = assignments[item.id];
    if (!Array.isArray(order)) return false;
    const expected = new Set(item.elements.map((el) => el.id));
    if (order.length !== expected.size) return false;
    return order.every((id) => expected.has(id));
  });
}
