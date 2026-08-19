import {
  countBlanksInGroupedFillBlanksItem,
  isGapFillPartialScoringQuestionType,
} from "@/lib/grouped-fill-blanks-utils";
import {
  createDefaultChoiceSubItem,
} from "@/components/admin/questions/ChoiceTaskItemsEditor";
import {
  createDefaultOrderingSubItem,
} from "@/components/admin/questions/OrderingItemsEditor";
import {
  createDefaultGroupedFillBlanksItem,
  type GroupedFillBlanksQuestionType,
} from "@/components/admin/questions/GroupedFillBlanksItemsEditor";
import type {
  QuestionField,
  QuestionKind,
} from "@/types/create-test-form";

export function defaultOptionsForType(
  kind: Exclude<
    QuestionKind,
    | "image_labeling"
    | "fill_in_the_blanks"
    | "fill_in_the_blanks_multi"
    | "fill_blanks_typing"
    | "fill_blanks_typing_multi"
    | "text_input"
    | "ordering"
    | "single_choice"
    | "multiple_choice"
  >,
): Extract<
  QuestionField,
  { type: "matching_puzzle" | "dnd_puzzle" }
>["options"] {
  return [
    { left: "", right: "" },
    { left: "", right: "" },
  ];
}

export function defaultImageLabelingQuestion(): Extract<
  QuestionField,
  { type: "image_labeling" }
> {
  return {
    text: "",
    type: "image_labeling",
    points: 1,
    exampleText: "",
    mediaPlayLimit: 0,
    labelingPairs: [{ url: "", correctWord: "", title: "" }],
  };
}

export function defaultGroupedFillBlanksQuestion(
  type: GroupedFillBlanksQuestionType,
): Extract<
  QuestionField,
  {
    type:
      | "fill_in_the_blanks"
      | "fill_in_the_blanks_multi"
      | "fill_blanks_typing"
      | "fill_blanks_typing_multi"
      | "text_input";
  }
> {
  const item = createDefaultGroupedFillBlanksItem(type);
  return {
    text: "",
    type,
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

export function defaultOrderingQuestion(): Extract<
  QuestionField,
  { type: "ordering" }
> {
  const item = createDefaultOrderingSubItem();
  return {
    text: "",
    type: "ordering",
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

export function defaultChoiceQuestion(
  type: "single_choice" | "multiple_choice",
): Extract<QuestionField, { type: "single_choice" | "multiple_choice" }> {
  const item = createDefaultChoiceSubItem();
  return {
    text: "",
    type,
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

export function emptyQuestion(): QuestionField {
  return defaultChoiceQuestion("single_choice");
}

export function sumChoiceTaskPoints(
  q: Extract<QuestionField, { type: "single_choice" | "multiple_choice" }>,
): number {
  return q.items.reduce(
    (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
    0,
  );
}

export function isChoiceQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "single_choice" | "multiple_choice" }> {
  return q.type === "single_choice" || q.type === "multiple_choice";
}

export function isOrderingQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "ordering" }> {
  return q.type === "ordering";
}

export function sumOrderingTaskPoints(
  q: Extract<QuestionField, { type: "ordering" }>,
): number {
  return q.items.reduce(
    (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
    0,
  );
}

export function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolveMediaPlayLimitField(q: QuestionField): number {
  return parseNonNegativeInt(String(q.mediaPlayLimit ?? 0), 0);
}

export function taskMediaFromQuestion(q: QuestionField) {
  return {
    text: q.text,
    exampleText: q.exampleText ?? "",
  };
}

export function isPuzzleQuestion(
  q: QuestionField,
): q is Extract<
  QuestionField,
  { type: "matching_puzzle" | "dnd_puzzle" }
> {
  return q.type === "matching_puzzle" || q.type === "dnd_puzzle";
}

export function isImageLabelingQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "image_labeling" }> {
  return q.type === "image_labeling";
}

export function isPartialPairScoringQuestion(q: QuestionField): boolean {
  return isPuzzleQuestion(q) || isImageLabelingQuestion(q);
}

/** Типы с баллами на уровне вложенных items (корневой input не показываем). */
export function isItemLevelScoringQuestion(q: QuestionField): boolean {
  return (
    isChoiceQuestion(q) ||
    isOrderingQuestion(q) ||
    isGroupedFillBlanksQuestion(q)
  );
}

/** Сумма баллов задания в форме админки (аналог resolveQuestionMaxPoints для QuestionField). */
export function resolveAdminQuestionMaxPoints(q: QuestionField): number {
  if (isChoiceQuestion(q)) {
    return sumChoiceTaskPoints(q);
  }
  if (isOrderingQuestion(q)) {
    return sumOrderingTaskPoints(q);
  }
  if (isGroupedFillBlanksQuestion(q)) {
    return sumGroupedFillBlanksPoints(q);
  }
  if (isPartialPairScoringQuestion(q)) {
    return sumPartialPairQuestionPoints(q);
  }
  return parsePositiveInt(String(q.points ?? 1), 1);
}

export function taskUnitPointsLabel(q: QuestionField): string {
  if (isPuzzleQuestion(q)) {
    return "Баллы за каждую пару";
  }
  if (isImageLabelingQuestion(q)) {
    return "Баллы за каждую метку";
  }
  return "Баллы за вопрос";
}

export function sumPartialPairQuestionPoints(q: QuestionField): number {
  const unitPoints = parsePositiveInt(String(q.points ?? 1), 1);
  if (isPuzzleQuestion(q)) {
    return unitPoints * Math.max(q.options.length, 1);
  }
  if (isImageLabelingQuestion(q)) {
    return unitPoints * Math.max(q.labelingPairs.length, 1);
  }
  return unitPoints;
}

export function isGroupedFillBlanksQuestion(
  q: QuestionField,
): q is Extract<
  QuestionField,
  {
    type:
      | "fill_in_the_blanks"
      | "fill_in_the_blanks_multi"
      | "fill_blanks_typing"
      | "fill_blanks_typing_multi"
      | "text_input";
  }
> {
  return (
    q.type === "fill_in_the_blanks" ||
    q.type === "fill_in_the_blanks_multi" ||
    q.type === "fill_blanks_typing" ||
    q.type === "fill_blanks_typing_multi" ||
    q.type === "text_input"
  );
}

export function sumGroupedFillBlanksPoints(
  q: Extract<
    QuestionField,
    {
      type:
        | "fill_in_the_blanks"
        | "fill_in_the_blanks_multi"
        | "fill_blanks_typing"
        | "fill_blanks_typing_multi"
        | "text_input";
    }
  >,
): number {
  return q.items.reduce((sum, item) => {
    const unitPoints = parsePositiveInt(String(item.points ?? 1), 1);
    if (isGapFillPartialScoringQuestionType(q.type)) {
      return (
        sum + unitPoints * countBlanksInGroupedFillBlanksItem(item)
      );
    }
    return sum + unitPoints;
  }, 0);
}
