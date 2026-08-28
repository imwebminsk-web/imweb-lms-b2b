import { parseTestIdFromQuizBlockContent } from "@/lib/learn/quiz-block-test-id";
import type { Database, Json } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

/**
 * Находит все уроки, где встречается этот тест:
 * 1) `lessons.test_id` — тест в подвале урока;
 * 2) quiz-блок с `content.test_id`;
 * 3) inline-тест через `tests.lesson_block_id`.
 */
export async function resolveLessonIdsForTest(
  supabase: DbClient,
  testId: string,
): Promise<{ ok: true; lessonIds: string[] } | { ok: false; error: string }> {
  const lessonIds = new Set<string>();

  const [lessonsRes, testRes, quizBlocksRes] = await Promise.all([
    supabase.from("lessons").select("id").eq("test_id", testId),
    supabase
      .from("tests")
      .select("lesson_block_id")
      .eq("id", testId)
      .maybeSingle(),
    supabase
      .from("lesson_blocks")
      .select("lesson_id, content")
      .eq("type", "quiz")
      .filter("content->>test_id", "eq", testId),
  ]);

  if (lessonsRes.error) {
    return { ok: false, error: lessonsRes.error.message };
  }
  if (testRes.error) {
    return { ok: false, error: testRes.error.message };
  }
  if (quizBlocksRes.error) {
    return { ok: false, error: quizBlocksRes.error.message };
  }

  for (const row of lessonsRes.data ?? []) {
    lessonIds.add(row.id);
  }

  for (const block of quizBlocksRes.data ?? []) {
    if (parseTestIdFromQuizBlockContent(block.content as Json) !== testId) {
      continue;
    }
    lessonIds.add(block.lesson_id);
  }

  const inlineBlockId = testRes.data?.lesson_block_id;
  if (inlineBlockId) {
    const { data: inlineBlock, error: inlineError } = await supabase
      .from("lesson_blocks")
      .select("lesson_id")
      .eq("id", inlineBlockId)
      .maybeSingle();

    if (inlineError) {
      return { ok: false, error: inlineError.message };
    }
    if (inlineBlock?.lesson_id) {
      lessonIds.add(inlineBlock.lesson_id);
    }
  }

  return { ok: true, lessonIds: [...lessonIds] };
}
