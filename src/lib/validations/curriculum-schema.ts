import { z } from "zod";

/** Данные формы «Добавить урок» (блоковый урок без устаревшего поля type). */
export const createLessonSchema = z.object({
  module_id: z.string().uuid("Некорректный идентификатор модуля."),
  course_id: z.string().uuid("Некорректный идентификатор курса."),
  title: z.string().trim().min(1, "Введите название урока.").max(200),
});

export type CreateLessonFormValues = z.infer<typeof createLessonSchema>;
