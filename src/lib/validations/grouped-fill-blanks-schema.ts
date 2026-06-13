import { z } from "zod";
import { hasRichTextContent } from "@/lib/utils/rich-text-content";
import {
  FillInTheBlanksContentSchema,
  FillInTheBlanksSegmentSchema,
  FillInTheBlanksWordSchema,
  TextInputContentSchema,
} from "@/lib/validations/fill-in-the-blanks-schema";

export const GROUPED_FILL_BLANKS_ANCHOR_TEXT = "__grouped_fill_blanks__";
export const LEGACY_GROUPED_FILL_ITEM_ID = "__legacy__";

const groupedFillBlanksItemBaseSchema = z.object({
  id: z.string().min(1),
  /** Сырой текст со скобками `[слово]` или `[]` — не HTML. */
  text: z.string().min(1, "Текст вопроса не может быть пустым"),
  points: z.coerce
    .number()
    .int("Баллы вопроса — целое число")
    .min(1, "Минимум 1 балл за вопрос"),
  segments: z
    .array(FillInTheBlanksSegmentSchema)
    .min(1, "Нужен хотя бы один сегмент"),
  wordBank: z.array(FillInTheBlanksWordSchema).default([]),
  correctMapping: z.record(z.string(), z.string()).default({}),
});

const validateFillBlanksItemContent = (
  item: z.infer<typeof groupedFillBlanksItemBaseSchema>,
  ctx: z.RefinementCtx,
) => {
  const parsed = FillInTheBlanksContentSchema.safeParse({
    segments: item.segments,
    wordBank: item.wordBank,
    correctMapping: item.correctMapping,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ["segments", ...(issue.path ?? [])],
      });
    }
  }
};

export const groupedFillInTheBlanksItemSchema =
  groupedFillBlanksItemBaseSchema.superRefine(validateFillBlanksItemContent);

export const groupedFillBlanksTypingItemSchema =
  groupedFillBlanksItemBaseSchema.superRefine(validateFillBlanksItemContent);

export const groupedTextInputItemSchema =
  groupedFillBlanksItemBaseSchema.superRefine((item, ctx) => {
    const parsed = TextInputContentSchema.safeParse({
      segments: item.segments,
      wordBank: item.wordBank,
      correctMapping: item.correctMapping,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ["segments", ...(issue.path ?? [])],
        });
      }
    }
  });

const taskInstructionSchema = z
  .string()
  .refine(
    (value) => hasRichTextContent(value) || value.trim().length > 0,
    "Текст задания не может быть пустым",
  );

export const groupedFillInTheBlanksContentSchema = z.object({
  text: taskInstructionSchema,
  example_text: z.string().optional(),
  items: z.array(groupedFillInTheBlanksItemSchema).min(1).optional(),
});

export const groupedFillBlanksContentSchema = z.object({
  text: taskInstructionSchema,
  example_text: z.string().optional(),
  items: z.array(groupedFillBlanksTypingItemSchema).min(1).optional(),
});

export const groupedTextInputContentSchema = z.object({
  text: taskInstructionSchema,
  example_text: z.string().optional(),
  items: z.array(groupedTextInputItemSchema).min(1).optional(),
});

export type GroupedFillBlanksItem = z.infer<
  typeof groupedFillBlanksTypingItemSchema
>;
export type GroupedFillInTheBlanksContent = z.infer<
  typeof groupedFillInTheBlanksContentSchema
>;
export type GroupedFillBlanksContent = z.infer<
  typeof groupedFillBlanksContentSchema
>;
export type GroupedTextInputContent = z.infer<
  typeof groupedTextInputContentSchema
>;
