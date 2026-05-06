import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";

export type QuestionKind =
  | "single_choice"
  | "multiple_choice"
  | "matching_puzzle"
  | "dnd_puzzle"
  | "image_labeling"
  | "fill_in_the_blanks";

export type ChoiceOptionField = { text: string; isCorrect: boolean };
export type PuzzleOptionField = { left: string; right: string };
/** Одна строка в БД: картинка + правильное слово для неё. */
export type LabelingPairField = { url: string; correctWord: string; title: string };

export type QuestionField =
  | {
      text: string;
      type: "single_choice" | "multiple_choice";
      options: ChoiceOptionField[];
    }
  | {
      text: string;
      type: "matching_puzzle" | "dnd_puzzle";
      options: PuzzleOptionField[];
    }
  | {
      text: string;
      type: "image_labeling";
      labelingPairs: LabelingPairField[];
    }
  | {
      text: string;
      type: "fill_in_the_blanks";
      fillRawText: string;
      fillExtraWords: string[];
      fillContent: FillInTheBlanksContent | null;
    };

export type CreateTestFormInitialData = {
  title: string;
  description: string;
  questions: QuestionField[];
};
