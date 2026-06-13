import { hasRichTextContent } from "@/lib/utils/rich-text-content";
import { z } from "zod";

/** Поля инструкции задания в JSONB `questions.content`. */
export const taskInstructionFieldsSchema = z.object({
  text: z
    .string()
    .refine(
      (value) => hasRichTextContent(value) || value.trim().length > 0,
      "Текст задания не может быть пустым",
    ),
  example_text: z.string().optional(),
});

export type TaskInstructionFields = z.infer<typeof taskInstructionFieldsSchema>;
