"use server";

import { createClient } from "@/lib/supabase/server";

export type GetPendingReviewCountsResult =
  | { success: true; counts: Record<string, number> }
  | { success: false; error: string };

/** Число сдач со статусом pending по когортам (через enrollments). */
export async function getPendingReviewCounts(): Promise<GetPendingReviewCountsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: rows, error } = await supabase.rpc("get_my_pending_review_counts");

  if (error) {
    console.error("[getPendingReviewCounts]", error.message);
    return { success: false, error: "Не удалось загрузить сдачи на проверку." };
  }

  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    if (row.cohort_id) {
      counts[row.cohort_id] = Number(row.pending_count);
    }
  }

  return { success: true, counts };
}
