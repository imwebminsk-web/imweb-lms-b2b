"use server";

import { revalidatePath } from "next/cache";

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

export type DeleteChatMessageResult =
  | { success: true }
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

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, is_chat_enabled, courses(teacher_id)")
    .eq("id", cid)
    .maybeSingle();

  if (cohortError || !cohort) {
    return { success: false, error: "Группа не найдена." };
  }

  const courseRel = Array.isArray(cohort.courses)
    ? cohort.courses[0]
    : cohort.courses;
  const isCourseTeacher = courseRel?.teacher_id === user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  if (!cohort.is_chat_enabled && !isCourseTeacher && !isAdmin) {
    return { success: false, error: "Чат отключен" };
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

/** Удаляет сообщение чата (учитель курса или админ). */
export async function deleteChatMessage(
  messageId: string,
): Promise<DeleteChatMessageResult> {
  const mid = messageId.trim();
  if (!mid) {
    return { success: false, error: "Не указано сообщение." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: message, error: messageError } = await supabase
    .from("cohort_messages")
    .select("id, cohort_id")
    .eq("id", mid)
    .maybeSingle();

  if (messageError) {
    console.error("[deleteChatMessage] fetch", messageError.message);
    return { success: false, error: "Не удалось найти сообщение." };
  }

  if (!message) {
    return { success: false, error: "Сообщение не найдено." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, courses(teacher_id)")
      .eq("id", message.cohort_id)
      .maybeSingle();

    if (cohortError || !cohort) {
      return { success: false, error: "Группа не найдена." };
    }

    const courseRel = Array.isArray(cohort.courses)
      ? cohort.courses[0]
      : cohort.courses;

    if (courseRel?.teacher_id !== user.id) {
      return { success: false, error: "Нет прав на удаление сообщения." };
    }
  }

  const { error: deleteError } = await supabase
    .from("cohort_messages")
    .delete()
    .eq("id", mid);

  if (deleteError) {
    console.error("[deleteChatMessage]", deleteError.message);
    return { success: false, error: "Не удалось удалить сообщение." };
  }

  revalidatePath("/", "layout");

  return { success: true };
}
