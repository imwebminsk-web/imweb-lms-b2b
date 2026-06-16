"use client";

import type {
  FillInTheBlanksSegment,
  FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";

export type QuestionKind =
  | "single_choice"
  | "multiple_choice"
  | "matching_puzzle"
  | "dnd_puzzle"
  | "image_labeling"
  | "fill_in_the_blanks"
  | "fill_in_the_blanks_multi"
  | "fill_blanks_typing"
  | "fill_blanks_typing_multi"
  | "text_input"
  | "ordering";

export type TestTypeKind = "training" | "final";

export type ChoiceOptionField = {
  id: string;
  text: string;
  isCorrect: boolean;
  /** Публичный URL изображения варианта (сохраняется в БД как `image_url`). */
  imageUrl?: string;
};

export type ChoiceSubItemField = {
  id: string;
  text: string;
  points: number;
  options: ChoiceOptionField[];
};

export type GroupedFillBlanksItemField = {
  id: string;
  /** Единый TipTap HTML: текст, медиа и скобки `[слово]` / `[]`. */
  text: string;
  parsedHtml?: string;
  points: number;
  segments: FillInTheBlanksSegment[];
  wordBank: FillInTheBlanksWord[];
  correctMapping: Record<string, string>;
  /** Дистракторы для DnD (`fill_in_the_blanks`) — только в форме, в БД входят в `wordBank`. */
  extraWords: string[];
};

type QuestionFieldBase = {
  text: string;
  points: number;
  /** Необязательный пример выполнения (хранится в content.example_text). */
  exampleText: string;
  /** Лимит воспроизведения загруженного audio/video в инструкции (0 = безлимит). */
  mediaPlayLimit: number;
};

export type FillInTheBlanksQuestionField = QuestionFieldBase & {
  type: "fill_in_the_blanks";
  items: GroupedFillBlanksItemField[];
};

export type FillInTheBlanksMultiQuestionField = QuestionFieldBase & {
  type: "fill_in_the_blanks_multi";
  items: GroupedFillBlanksItemField[];
};

export type FillBlanksTypingQuestionField = QuestionFieldBase & {
  type: "fill_blanks_typing";
  items: GroupedFillBlanksItemField[];
};

export type FillBlanksTypingMultiQuestionField = QuestionFieldBase & {
  type: "fill_blanks_typing_multi";
  items: GroupedFillBlanksItemField[];
};

export type TextInputQuestionField = QuestionFieldBase & {
  type: "text_input";
  items: GroupedFillBlanksItemField[];
};

export type OrderingElementField = {
  id: string;
  text: string;
};

export type OrderingSubItemField = {
  id: string;
  text: string;
  points: number;
  elements: OrderingElementField[];
};

export type OrderingQuestionField = QuestionFieldBase & {
  type: "ordering";
  items: OrderingSubItemField[];
};

export type ChoiceQuestionField = QuestionFieldBase & {
  type: "single_choice" | "multiple_choice";
  items: ChoiceSubItemField[];
};

export type QuestionField =
  | ChoiceQuestionField
  | FillInTheBlanksQuestionField
  | FillInTheBlanksMultiQuestionField
  | FillBlanksTypingQuestionField
  | FillBlanksTypingMultiQuestionField
  | TextInputQuestionField
  | OrderingQuestionField
  | (QuestionFieldBase & {
      type: "matching_puzzle" | "dnd_puzzle";
      options: PuzzleOptionField[];
    })
  | (QuestionFieldBase & {
      type: "image_labeling";
      labelingPairs: LabelingPairField[];
    });

export type PuzzleOptionField = { left: string; right: string };
/** Одна строка в БД: картинка + правильное слово для неё. */
export type LabelingPairField = { url: string; correctWord: string; title: string };

export type CreateTestFormInitialData = {
  title: string;
  description: string;
  folderName: string;
  titleTeacher?: string;
  titleStudent?: string;
  testType?: TestTypeKind;
  autoCheck?: boolean;
  saveToJournal?: boolean;
  maxScore?: number;
  timeLimit?: number;
  isForKids?: boolean;
  isPublished?: boolean;
  questions: QuestionField[];
};
