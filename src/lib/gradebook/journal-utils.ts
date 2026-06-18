import type { Json } from "@/types/database.types";

export function readBlockSaveToJournal(content: Json): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  return (content as Record<string, unknown>).save_to_journal === true;
}

export function readBlockIsForKids(content: Json): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  return (content as Record<string, unknown>).is_for_kids === true;
}
