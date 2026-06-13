import { z } from "zod";
import { hasRichTextContent } from "@/lib/utils/rich-text-content";

export const GROUPED_CHOICE_ANCHOR_TEXT = "__grouped_choice__";
export const LEGACY_GROUPED_ITEM_ID = "__legacy__";

const groupedChoiceItemOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, "Текст варианта не может быть пустым"),
  is_correct: z.boolean(),
});

export const groupedChoiceItemSchema = z.object({
  id: z.string().min(1),
  text: z
    .string()
    .refine(hasRichTextContent, "Текст вопроса не может быть пустым"),
  points: z.coerce
    .number()
    .int("Баллы вопроса — целое число")
    .min(1, "Минимум 1 балл за вопрос"),
  options: z
    .array(groupedChoiceItemOptionSchema)
    .min(1, "Нужен хотя бы один вариант ответа"),
});

export const groupedChoiceContentSchema = z.object({
  text: z
    .string()
    .refine(
      (value) => hasRichTextContent(value) || value.trim().length > 0,
      "Текст задания не может быть пустым",
    ),
  example_text: z.string().optional(),
  items: z.array(groupedChoiceItemSchema).min(1).optional(),
});

export type GroupedChoiceItem = z.infer<typeof groupedChoiceItemSchema>;
export type GroupedChoiceContent = z.infer<typeof groupedChoiceContentSchema>;
