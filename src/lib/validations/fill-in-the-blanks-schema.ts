import { z } from "zod";

/**
 * JSON для колонки `questions.content` при `type === "fill_in_the_blanks"`.
 * Сегменты задают порядок кусков текста и пропусков — без regex на клиенте.
 */

export const FillInTheBlanksSegmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("blank"),
    id: z.string().min(1, "У пропуска должен быть непустой id"),
  }),
]);

export const FillInTheBlanksWordSchema = z.object({
  id: z.string().min(1, "У слова в банке должен быть непустой id"),
  text: z.string().min(1, "Текст слова не может быть пустым"),
});

export const FillInTheBlanksContentSchema = z
  .object({
    segments: z
      .array(FillInTheBlanksSegmentSchema)
      .min(1, "Нужен хотя бы один сегмент"),
    wordBank: z
      .array(FillInTheBlanksWordSchema)
      .min(1, "Нужно хотя бы одно слово в банке"),
    /** Ключ — id пропуска (`blank.id`), значение — id слова из `wordBank`. */
    correctMapping: z.record(z.string(), z.string()),
  })
  .superRefine((data, ctx) => {
    const blankIds: string[] = [];
    for (const seg of data.segments) {
      if (seg.type === "blank") blankIds.push(seg.id);
    }

    if (blankIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Добавьте хотя бы один пропуск (сегмент type: blank)",
        path: ["segments"],
      });
      return;
    }

    const blankSet = new Set(blankIds);
    if (blankSet.size !== blankIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Id пропусков не должны повторяться",
        path: ["segments"],
      });
    }

    const wordIds = new Set(data.wordBank.map((w) => w.id));
    if (wordIds.size !== data.wordBank.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Id слов в банке не должны повторяться",
        path: ["wordBank"],
      });
    }

    const mapKeys = Object.keys(data.correctMapping);
    const mapKeySet = new Set(mapKeys);

    for (const bid of blankSet) {
      if (!mapKeySet.has(bid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Нет пары в correctMapping для пропуска "${bid}"`,
          path: ["correctMapping"],
        });
      }
    }

    for (const k of mapKeySet) {
      if (!blankSet.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Лишний ключ correctMapping: "${k}" (нет такого пропуска)`,
          path: ["correctMapping", k],
        });
      }
    }

    for (const [blankId, wordId] of Object.entries(data.correctMapping)) {
      if (!wordIds.has(wordId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Слово "${wordId}" не найдено в wordBank`,
          path: ["correctMapping", blankId],
        });
      }
    }
  });

export type FillInTheBlanksSegment = z.infer<typeof FillInTheBlanksSegmentSchema>;
export type FillInTheBlanksWord = z.infer<typeof FillInTheBlanksWordSchema>;
export type FillInTheBlanksContent = z.infer<typeof FillInTheBlanksContentSchema>;

/** Развёрнутый ответ (`text_input`): пустые `[]` без эталона и wordBank. */
export const TextInputContentSchema = z
  .object({
    segments: z
      .array(FillInTheBlanksSegmentSchema)
      .min(1, "Нужен хотя бы один сегмент"),
    wordBank: z.array(FillInTheBlanksWordSchema).default([]),
    correctMapping: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((data, ctx) => {
    const blankIds = data.segments
      .filter((seg) => seg.type === "blank")
      .map((seg) => seg.id);

    if (blankIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Добавьте хотя бы один пропуск (пустые скобки [] )",
        path: ["segments"],
      });
      return;
    }

    const blankSet = new Set(blankIds);
    if (blankSet.size !== blankIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Id пропусков не должны повторяться",
        path: ["segments"],
      });
    }

    const wordIds = new Set(data.wordBank.map((w) => w.id));
    for (const [blankId, wordId] of Object.entries(data.correctMapping)) {
      if (!blankSet.has(blankId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Лишний ключ correctMapping: "${blankId}"`,
          path: ["correctMapping", blankId],
        });
      } else if (wordId && !wordIds.has(wordId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Слово "${wordId}" не найдено в wordBank`,
          path: ["correctMapping", blankId],
        });
      }
    }
  });

export type TextInputContent = z.infer<typeof TextInputContentSchema>;

export function blankIdsFromSegments(
  segments: FillInTheBlanksSegment[],
): string[] {
  return segments.filter((seg) => seg.type === "blank").map((seg) => seg.id);
}
