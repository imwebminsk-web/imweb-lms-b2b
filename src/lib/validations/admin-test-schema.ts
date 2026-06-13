import {
  groupedFillBlanksContentSchema,
  groupedFillInTheBlanksContentSchema,
  groupedTextInputContentSchema,
} from "@/lib/validations/grouped-fill-blanks-schema";
import { groupedChoiceContentSchema } from "@/lib/validations/grouped-choice-schema";
import { taskInstructionFieldsSchema } from "@/lib/validations/task-content-schema";
import { z } from "zod";

/** Текст варианта ответа в `options.content`. */
const jsonTextContentSchema = z.object({
  text: z.string().min(1, "Текст не может быть пустым"),
});

/** Пара для пазла в `options.content`. */
const puzzlePairContentSchema = z.object({
  left: z.string().min(1, "Левая часть не может быть пустой"),
  right: z.string().min(1, "Правая часть не может быть пустой"),
});

const choiceOptionsSchema = z
  .array(
    z.object({
      content: jsonTextContentSchema,
      is_correct: z.boolean(),
    }),
  )
  .min(1, "Нужен хотя бы один вариант ответа");

const puzzleOptionsSchema = z
  .array(
    z.object({
      content: puzzlePairContentSchema,
      is_correct: z.literal(true),
    }),
  )
  .min(2, "Для пазла нужно минимум две пары");

/** Одна строка в БД = пара «картинка + правильная подпись» (`correctText` в JSON). */
const imageLabelingPairOptionSchema = z.object({
  content: z.object({
    imageUrl: z.string().min(1, "Укажите URL изображения"),
    correctText: z.string().min(1, "Укажите правильное слово для этой картинки"),
    title: z.string().optional(),
  }),
  is_correct: z.literal(true),
});

const imageLabelingOptionsSchema = z
  .array(imageLabelingPairOptionSchema)
  .min(1, "Добавьте хотя бы одну пару «картинка — слово»");

const emptyOptionsSchema = z
  .array(
    z.object({
      content: jsonTextContentSchema,
      is_correct: z.boolean(),
    }),
  )
  .length(0);

const questionPointsSchema = z.coerce
  .number()
  .int("Баллы за вопрос — целое число")
  .min(1, "Минимум 1 балл за вопрос")
  .default(1);

const choiceOptionsOrEmptySchema = z.union([choiceOptionsSchema, emptyOptionsSchema]);

export const adminQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    content: groupedChoiceContentSchema,
    type: z.literal("single_choice"),
    points: questionPointsSchema,
    options: choiceOptionsOrEmptySchema,
  }),
  z.object({
    content: groupedChoiceContentSchema,
    type: z.literal("multiple_choice"),
    points: questionPointsSchema,
    options: choiceOptionsOrEmptySchema,
  }),
  z.object({
    content: taskInstructionFieldsSchema,
    type: z.literal("matching_puzzle"),
    points: questionPointsSchema,
    options: puzzleOptionsSchema,
  }),
  z.object({
    content: taskInstructionFieldsSchema,
    type: z.literal("dnd_puzzle"),
    points: questionPointsSchema,
    options: puzzleOptionsSchema,
  }),
  z.object({
    content: taskInstructionFieldsSchema,
    type: z.literal("image_labeling"),
    points: questionPointsSchema,
    options: imageLabelingOptionsSchema,
  }),
  z.object({
    content: groupedFillInTheBlanksContentSchema,
    type: z.literal("fill_in_the_blanks"),
    points: questionPointsSchema,
    options: emptyOptionsSchema,
  }),
  z.object({
    content: groupedFillBlanksContentSchema,
    type: z.literal("fill_blanks_typing"),
    points: questionPointsSchema,
    options: emptyOptionsSchema,
  }),
  z.object({
    content: groupedTextInputContentSchema,
    type: z.literal("text_input"),
    points: questionPointsSchema,
    options: emptyOptionsSchema,
  }),
]);

export const saveFullTestPayloadSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional().nullable(),
    folder_name: z.string().optional().nullable(),
    is_published: z.boolean().optional().default(true),
    title_teacher: z.string().optional().nullable(),
    title_student: z.string().optional().nullable(),
    test_type: z.enum(["training", "final"]).default("final"),
    auto_check: z.boolean().default(true),
    save_to_journal: z.boolean().default(true),
    max_score: z.coerce
      .number()
      .int("Максимальный балл — целое число")
      .min(1, "Максимальный балл должен быть больше 0")
      .default(100),
    is_for_kids: z.boolean().default(false),
    questions: z
      .array(adminQuestionSchema)
      .min(1, "Добавьте хотя бы один вопрос"),
  })
  .transform((data) => ({
    ...data,
    title:
      data.title?.trim() ||
      data.title_teacher?.trim() ||
      "Без названия",
    description: data.description ?? null,
  }))
  .superRefine((data, ctx) => {
    data.questions.forEach((q, i) => {
      if (
        q.type === "matching_puzzle" ||
        q.type === "dnd_puzzle" ||
        q.type === "image_labeling" ||
        q.type === "fill_in_the_blanks" ||
        q.type === "fill_blanks_typing" ||
        q.type === "text_input"
      ) {
        return;
      }

      if (q.type === "single_choice" || q.type === "multiple_choice") {
        const items = q.content.items;
        if (items && items.length > 0) {
          items.forEach((item, itemIndex) => {
            if (!item.options.some((o) => o.is_correct)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Отметьте хотя бы один верный вариант в вопросе",
                path: ["questions", i, "content", "items", itemIndex, "options"],
              });
            }
          });
          return;
        }
      }

      if (!q.options.some((o) => o.is_correct)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Отметьте хотя бы один верный вариант",
          path: ["questions", i, "options"],
        });
      }
    });
  });

export type SaveFullTestPayload = z.infer<typeof saveFullTestPayloadSchema>;
