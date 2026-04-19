import type { Database } from "@/types/database.types";

export type LessonBlockType = Database["public"]["Enums"]["lesson_block_type"];

export type LessonBlockActionState = {
  success?: boolean;
  error?: string;
  blockId?: string;
};
