import type { Json } from "@/types/database.types";

/**
 * Достаёт UUID теста из контента блока `quiz` (объект из БД или строка JSON).
 */
export function parseTestIdFromQuizBlockContent(content: Json): string | null {
  let obj: unknown = content;
  if (typeof content === "string") {
    try {
      obj = JSON.parse(content) as unknown;
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const tid = (obj as Record<string, unknown>).test_id;
  if (typeof tid !== "string") return null;
  const trimmed = tid.trim();
  return trimmed.length > 0 ? trimmed : null;
}
