"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type MarkChatAsReadResult =
  | { success: true }
  | { success: false; error: string };

export type GetUnreadCountsResult =
  | { success: true; counts: Record<string, number> }
  | { success: false; error: string };

async function collectAccessibleCohortIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const cohortIds = new Set<string>();

  const { data: enrollRows, error: enrollError } = await supabase
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", userId)
    .not("cohort_id", "is", null);

  if (enrollError) {
    throw new Error(enrollError.message);
  }

  for (const row of enrollRows ?? []) {
    if (row.cohort_id) {
      cohortIds.add(row.cohort_id);
    }
  }

  const { data: teacherCohorts, error: teacherError } = await supabase
    .from("cohorts")
    .select("id, courses!inner(teacher_id)")
    .eq("courses.teacher_id", userId);

  if (teacherError) {
    throw new Error(teacherError.message);
  }

  for (const row of teacherCohorts ?? []) {
    cohortIds.add(row.id);
  }

  return [...cohortIds];
}

/** Отмечает чат когорты прочитанным для текущего пользователя. */
export async function markChatAsRead(
  cohortId: string,
): Promise<MarkChatAsReadResult> {
  const cid = cohortId.trim();
  if (!cid) {
    return { success: false, error: "Не указана группа." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { error } = await supabase.from("chat_read_receipts").upsert(
    {
      user_id: user.id,
      cohort_id: cid,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,cohort_id" },
  );

  if (error) {
    console.error("[markChatAsRead]", error.message);
    return { success: false, error: "Не удалось отметить чат прочитанным." };
  }

  revalidatePath("/", "layout");

  return { success: true };
}

/** Число непрочитанных сообщений по каждой доступной пользователю когорте. */
export async function getUnreadCounts(): Promise<GetUnreadCountsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  let cohortIds: string[];
  try {
    cohortIds = await collectAccessibleCohortIds(supabase, user.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить группы.";
    console.error("[getUnreadCounts]", message);
    return { success: false, error: message };
  }

  if (cohortIds.length === 0) {
    return { success: true, counts: {} };
  }

  const { data: receiptRows, error: receiptError } = await supabase
    .from("chat_read_receipts")
    .select("cohort_id, last_read_at")
    .eq("user_id", user.id)
    .in("cohort_id", cohortIds);

  if (receiptError) {
    console.error("[getUnreadCounts] receipts", receiptError.message);
    return { success: false, error: "Не удалось загрузить отметки прочтения." };
  }

  const lastReadByCohort = new Map<string, string>();
  for (const row of receiptRows ?? []) {
    lastReadByCohort.set(row.cohort_id, row.last_read_at);
  }

  const counts: Record<string, number> = {};

  await Promise.all(
    cohortIds.map(async (cohortId) => {
      const lastReadAt = lastReadByCohort.get(cohortId);

      let query = supabase
        .from("cohort_messages")
        .select("id", { count: "exact", head: true })
        .eq("cohort_id", cohortId)
        .neq("user_id", user.id);

      if (lastReadAt) {
        query = query.gt("created_at", lastReadAt);
      }

      const { count, error } = await query;

      if (error) {
        console.error(
          `[getUnreadCounts] cohort_messages ${cohortId}`,
          error.message,
        );
        counts[cohortId] = 0;
        return;
      }

      counts[cohortId] = count ?? 0;
    }),
  );

  return { success: true, counts };
}
