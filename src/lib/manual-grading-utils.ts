import type { Json } from "@/types/database.types";

/** Ключ в `answer_data` для баллов преподавателя по подзаданиям text_input. */
export const MANUAL_ITEM_GRADES_KEY = "manualItemGrades";

export function parseManualItemGradesFromAnswerData(
  answerData: Json | null,
): Record<string, number> | null {
  if (!answerData || typeof answerData !== "object" || Array.isArray(answerData)) {
    return null;
  }
  const raw = (answerData as Record<string, unknown>)[MANUAL_ITEM_GRADES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = Math.max(0, Math.round(value));
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sumManualItemGrades(grades: Record<string, number>): number {
  return Object.values(grades).reduce((sum, n) => sum + Math.max(0, n), 0);
}

export function mergeManualItemGradesIntoAnswerData(
  existing: Json | null,
  itemGrades: Record<string, number>,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    [MANUAL_ITEM_GRADES_KEY]: itemGrades,
  } as Json;
}
