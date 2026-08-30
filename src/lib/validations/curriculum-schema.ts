import { z } from "zod";

const idSchema = z.string().trim().min(1, "Не указан идентификатор.");
const titleSchema = z
  .string()
  .trim()
  .min(1, "Введите название.")
  .max(200, "Название не длиннее 200 символов.");
const directionSchema = z.enum(["up", "down"]);

export const createModuleSchema = z.object({
  courseId: idSchema,
  title: titleSchema,
});

export type CreateModulePayload = z.infer<typeof createModuleSchema>;

export const createLessonSchema = z.object({
  moduleId: idSchema,
  title: titleSchema,
});

export type CreateLessonPayload = z.infer<typeof createLessonSchema>;
export type CreateLessonFormValues = CreateLessonPayload;

export const updateModuleSchema = z.object({
  moduleId: idSchema,
  title: titleSchema,
});

export type UpdateModulePayload = z.infer<typeof updateModuleSchema>;

export const updateLessonSchema = z.object({
  lessonId: idSchema,
  title: titleSchema,
  type: z.enum(["text", "video", "quiz", "test"]),
  isPublished: z.boolean().optional(),
  videoUrl: z.string().optional(),
  body: z.string().optional(),
  testId: z.string().trim().optional().nullable(),
});

export type UpdateLessonPayload = z.infer<typeof updateLessonSchema>;

export const deleteModuleSchema = z.object({
  moduleId: idSchema,
});

export const deleteLessonSchema = z.object({
  lessonId: idSchema,
});

export const reorderModuleSchema = z.object({
  courseId: idSchema,
  moduleId: idSchema,
  direction: directionSchema,
});

export type ReorderModulePayload = z.infer<typeof reorderModuleSchema>;

export const reorderLessonSchema = z.object({
  moduleId: idSchema,
  lessonId: idSchema,
  direction: directionSchema,
});

export type ReorderLessonPayload = z.infer<typeof reorderLessonSchema>;
