import { z } from "zod";

import type { Json } from "@/types/database.types";

const idSchema = z.string().trim().min(1, "Не указан идентификатор.");
const titleSchema = z
  .string()
  .trim()
  .min(1, "Введите название урока.")
  .max(200, "Название не длиннее 200 символов.");

export const lessonBlockTypeSchema = z.enum([
  "text",
  "image",
  "youtube",
  "vimeo",
  "assignment",
  "quiz",
]);

export const updateLessonMetaSchema = z.object({
  lessonId: idSchema,
  title: titleSchema,
  is_published: z.boolean(),
});

export type UpdateLessonMetaPayload = z.infer<typeof updateLessonMetaSchema>;

export const addBlockSchema = z.object({
  lessonId: idSchema,
  type: lessonBlockTypeSchema,
});

export type AddBlockPayload = z.infer<typeof addBlockSchema>;

export const updateBlockSchema = z.object({
  blockId: idSchema,
  content: z.custom<Json>(
    (value) =>
      value !== undefined &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value),
    { message: "Некорректное содержимое блока." },
  ),
});

export type UpdateBlockPayload = z.infer<typeof updateBlockSchema>;

export const deleteBlockSchema = z.object({
  blockId: idSchema,
});

export type DeleteBlockPayload = z.infer<typeof deleteBlockSchema>;

export const reorderBlockSchema = z.object({
  lessonId: idSchema,
  blockId: idSchema,
  direction: z.enum(["up", "down"]),
});

export type ReorderBlockPayload = z.infer<typeof reorderBlockSchema>;

export const uploadBlockImageSchema = z.object({
  lessonId: idSchema,
  blockId: idSchema,
});

export type UploadBlockImagePayload = z.infer<typeof uploadBlockImageSchema>;
