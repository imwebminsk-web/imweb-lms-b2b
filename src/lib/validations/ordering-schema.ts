import { z } from "zod";

export const GROUPED_ORDERING_ANCHOR_TEXT = "__grouped_ordering__";

export const orderingElementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, "Текст элемента не может быть пустым"),
});

export const orderingItemSchema = z.object({
  id: z.string().min(1),
  /** Необязательный TipTap HTML: инструкция или контекст для этой последовательности. */
  text: z.string().optional().default(""),
  points: z.coerce
    .number()
    .int("Баллы вопроса — целое число")
    .min(1, "Минимум 1 балл за вопрос"),
  /** Элементы в ПРАВИЛЬНОМ порядке (для ученика перемешиваются). */
  elements: z
    .array(orderingElementSchema)
    .min(2, "Нужно минимум два элемента для упорядочивания"),
});

export const orderingContentSchema = z.object({
  text: z
    .string()
    .refine(
      (value) => value.trim().length > 0,
      "Текст задания не может быть пустым",
    ),
  example_text: z.string().optional(),
  items: z.array(orderingItemSchema).min(1).optional(),
});

export type OrderingElement = z.infer<typeof orderingElementSchema>;
export type OrderingItem = z.infer<typeof orderingItemSchema>;
export type OrderingContent = z.infer<typeof orderingContentSchema>;
