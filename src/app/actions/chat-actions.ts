"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";

export type CohortChatMessage = {
  id: string;
  cohortId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type GetCohortMessagesResult =
  | { success: true; messages: CohortChatMessage[] }
  | { success: false; error: string };

export type SendChatMessageResult =
  | { success: true; message: CohortChatMessage }
  | { success: false; error: string };

const MAX_MESSAGE_LENGTH = 2000;

type RawMessageRow = {
  id: string;
  cohort_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

async function fetchProfilesByUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, { full_name: string | null; avatar_url: string | null }>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, { full_name: string | null; avatar_url: string | null }>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", uniqueIds);

  if (error) {
    console.error("[chat-actions] profiles", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, {
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    });
  }

  return map;
}

function mapMessageRow(
  row: RawMessageRow,
  profile: { full_name: string | null; avatar_url: string | null } | undefined,
): CohortChatMessage {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    authorName: resolveStudentDisplayName(profile?.full_name, null, row.user_id),
    authorAvatarUrl: profile?.avatar_url ?? null,
  };
}

/** Последние 50 сообщений когорты в хронологическом порядке. */
export async function getCohortMessages(
  cohortId: string,
): Promise<GetCohortMessagesResult> {
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

  const { data, error } = await supabase
    .from("cohort_messages")
    .select("id, cohort_id, user_id, content, created_at")
    .eq("cohort_id", cid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getCohortMessages]", error.message);
    return { success: false, error: "Не удалось загрузить сообщения." };
  }

  const rows = (data ?? []) as RawMessageRow[];
  const profiles = await fetchProfilesByUserIds(
    supabase,
    rows.map((row) => row.user_id),
  );

  const messages = rows
    .reverse()
    .map((row) => mapMessageRow(row, profiles.get(row.user_id)));

  return { success: true, messages };
}

/** Отправляет сообщение от имени текущего пользователя. */
export async function sendChatMessage(
  cohortId: string,
  content: string,
): Promise<SendChatMessageResult> {
  const cid = cohortId.trim();
  const text = content.trim();

  if (!cid) {
    return { success: false, error: "Не указана группа." };
  }
  if (!text) {
    return { success: false, error: "Введите текст сообщения." };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `Сообщение не длиннее ${MAX_MESSAGE_LENGTH} символов.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data, error } = await supabase
    .from("cohort_messages")
    .insert({
      cohort_id: cid,
      user_id: user.id,
      content: text,
    })
    .select("id, cohort_id, user_id, content, created_at")
    .single();

  if (error || !data) {
    console.error("[sendChatMessage]", error?.message);
    return { success: false, error: "Не удалось отправить сообщение." };
  }

  const profiles = await fetchProfilesByUserIds(supabase, [user.id]);
  const message = mapMessageRow(data as RawMessageRow, profiles.get(user.id));

  return { success: true, message };
}
