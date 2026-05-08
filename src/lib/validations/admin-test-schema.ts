import { FillInTheBlanksContentSchema } from "@/lib/validations/fill-in-the-blanks-schema";
import { z } from "zod";

/** Текст вопроса и вариантов single/multiple: `{ "text": "..." }`. */
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

export const adminQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    content: jsonTextContentSchema,
    type: z.literal("single_choice"),
    options: choiceOptionsSchema,
  }),
  z.object({
    content: jsonTextContentSchema,
    type: z.literal("multiple_choice"),
    options: choiceOptionsSchema,
  }),
  z.object({
    content: jsonTextContentSchema,
    type: z.literal("matching_puzzle"),
    options: puzzleOptionsSchema,
  }),
  z.object({
    content: jsonTextContentSchema,
    type: z.literal("dnd_puzzle"),
    options: puzzleOptionsSchema,
  }),
  z.object({
    content: jsonTextContentSchema,
    type: z.literal("image_labeling"),
    options: imageLabelingOptionsSchema,
  }),
  z.object({
    content: FillInTheBlanksContentSchema,
    type: z.literal("fill_in_the_blanks"),
    options: emptyOptionsSchema,
  }),
]);

export const saveFullTestPayloadSchema = z
  .object({
    title: z.string().min(1, "Укажите название теста"),
    description: z.string().optional().nullable(),
    folder_name: z.string().optional().nullable(),
    is_published: z.boolean().optional().default(true),
    questions: z
      .array(adminQuestionSchema)
      .min(1, "Добавьте хотя бы один вопрос"),
  })
  .superRefine((data, ctx) => {
    data.questions.forEach((q, i) => {
      if (
        q.type === "matching_puzzle" ||
        q.type === "dnd_puzzle" ||
        q.type === "image_labeling" ||
        q.type === "fill_in_the_blanks"
      ) {
        return;
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
