import { z } from "zod";

export {
  choiceOptionSchema,
  groupedChoiceContentSchema,
} from "@/lib/validations/grouped-choice-schema";

// -----------------------------------------------------------------------------
// JSONB-контент вопросов и вариантов (MVP: без жёсткой формы структуры)
// -----------------------------------------------------------------------------

/** Произвольный JSON для колонки `questions.content` (JSONB). */
export const questionContentJsonSchema = z.any();

/** Произвольный JSON для колонки `options.content` (JSONB). */
export const optionContentJsonSchema = z.any();

// -----------------------------------------------------------------------------
// Тип вопроса (строковый slug в БД после миграции VARCHAR)
// -----------------------------------------------------------------------------

export const QUESTION_TYPE_SLUGS = [
  "true_false",
  "single_choice",
  "multiple_choice",
  "ordering",
  "matching_puzzle",
  "dnd_puzzle",
  "image_hotspot",
  "text_input",
  "fill_blanks_text",
  "fill_blanks_dnd",
  "image_select_objects",
  "image_dnd_labels",
  /** Подпиши картинку: DnD слов на изображения (options: imageUrl / labelText|text). */
  "image_labeling",
  /** Заполнение пропусков в тексте (DnD слов); контент см. FillInTheBlanksContentSchema. */
  "fill_in_the_blanks",
  /** Несколько предложений с пропусками (DnD). */
  "fill_in_the_blanks_multi",
  /** Пропуски вручную: ввод текста в inline-поля; контент тот же JSON. */
  "fill_blanks_typing",
  /** Несколько предложений с ручным вводом пропусков. */
  "fill_blanks_typing_multi",
  /** Легаси после ENUM */
  "single",
  "multiple",
] as const;

/** Строгий список известных типов (админка, импорт). */
export const questionTypeSlugSchema = z.enum(QUESTION_TYPE_SLUGS);

/** Строковый slug типа вопроса (как в `questions.type`). */
export type QuestionTypeSlug = (typeof QUESTION_TYPE_SLUGS)[number];

/** MVP: любой короткий строковый тип (эксперименты без правки схемы). */
export const questionTypeLooseSchema = z.string().max(50).nullable();

// -----------------------------------------------------------------------------
// Ответ ученика: option_id + answer_data (сложные интерактивы)
// -----------------------------------------------------------------------------

/**
 * Поле «выбранный ответ» в разных форматах:
 * - один UUID (классический single choice);
 * - массив UUID (multiple choice / порядок id на клиенте);
 * - объект (координаты hotspot, произвольный JSON) — см. ограничения в Server Action.
 */
export const answerOptionIdFieldSchema = z.union([
  z.string().uuid("Некорректный ID варианта ответа"),
  z.array(z.string().uuid("Некорректный элемент массива")).min(1),
  z.record(z.string(), z.any()),
]);

export const questionAnswerSchema = z
  .object({
    question_id: z.string().uuid("Некорректный ID вопроса"),
    option_id: answerOptionIdFieldSchema.optional(),
    /** Сложный ответ: координаты, порядок, текст с пропусками и т.д. */
    answer_data: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const ad = data.answer_data;
    if (ad && typeof ad === "object" && !Array.isArray(ad)) {
      const mp = (ad as { matchingPairs?: unknown }).matchingPairs;
      const pr = (ad as { pairs?: unknown }).pairs;
      if (Array.isArray(mp) && mp.length > 0) {
        return;
      }
      if (Array.isArray(pr) && pr.length > 0) {
        return;
      }
    }
    const hasOptionId = data.option_id !== undefined;
    const hasAnswerData = ad !== undefined && ad !== null;
    if (!hasOptionId && !hasAnswerData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите option_id и/или answer_data",
        path: ["option_id"],
      });
    }
  });

export type QuestionAnswerInput = z.infer<typeof questionAnswerSchema>;

/** Ответ ученика в рамках конкретной попытки. */
export const submitAnswerSchema = questionAnswerSchema.extend({
  attempt_id: z.string().uuid("Некорректный ID попытки"),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
