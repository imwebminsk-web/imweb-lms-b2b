import type { FillInTheBlanksContent } from "@/lib/validations/fill-in-the-blanks-schema";

export function blankIdsFromFillContent(
  content: FillInTheBlanksContent,
): string[] {
  return content.segments
    .filter((seg) => seg.type === "blank")
    .map((seg) => seg.id);
}

export function correctTextForBlank(
  content: FillInTheBlanksContent,
  blankId: string,
): string | null {
  const wordId = content.correctMapping[blankId];
  if (!wordId) return null;
  const word = content.wordBank.find((w) => w.id === wordId);
  return word?.text ?? null;
}

/** Строгое сравнение: только trim по краям; регистр и пунктуация должны совпадать. */
export function isFillBlankTypingAnswerCorrect(
  typed: string,
  expected: string,
): boolean {
  return typed.trim() === expected.trim();
}

/** Строгое сравнение всех пропусков (trim по краям). */
export function isFillBlanksTypingFullyCorrect(
  content: FillInTheBlanksContent,
  fillTyping: Record<string, string>,
): boolean {
  const blankIds = blankIdsFromFillContent(content);
  if (blankIds.length === 0) return false;

  return blankIds.every((blankId) => {
    const expected = correctTextForBlank(content, blankId);
    if (expected == null) return false;
    const typed = fillTyping[blankId];
    if (typeof typed !== "string") return false;
    return isFillBlankTypingAnswerCorrect(typed, expected);
  });
}
