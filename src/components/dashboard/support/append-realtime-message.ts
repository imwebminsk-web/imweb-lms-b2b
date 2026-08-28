import type { SupportChatMessage } from "@/app/actions/support-actions";

export type SupportRealtimeRow = {
  id?: string;
  ticket_id?: string;
  sender_id?: string;
  content?: string;
  created_at?: string;
};

export function appendSupportRealtimeMessage(
  prev: SupportChatMessage[],
  row: SupportRealtimeRow,
  currentUserId: string,
): SupportChatMessage[] {
  if (!row.id || !row.ticket_id || !row.sender_id || !row.content) {
    return prev;
  }

  if (prev.some((message) => message.id === row.id)) {
    return prev;
  }

  const existing = prev.find((message) => message.senderId === row.sender_id);
  const isOwn = row.sender_id === currentUserId;

  return [
    ...prev,
    {
      id: row.id,
      ticketId: row.ticket_id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at ?? new Date().toISOString(),
      authorName: existing?.authorName ?? (isOwn ? "Вы" : "Поддержка"),
      authorAvatarUrl: existing?.authorAvatarUrl ?? null,
      authorRole: existing?.authorRole ?? (isOwn ? "student" : "admin"),
    },
  ];
}

/** Fetch не затирает сообщения, которые Realtime успел дописать во время запроса. */
export function mergeFetchedSupportMessages(
  fetched: SupportChatMessage[],
  local: SupportChatMessage[],
): SupportChatMessage[] {
  const byId = new Map<string, SupportChatMessage>();

  for (const message of fetched) {
    byId.set(message.id, message);
  }

  for (const message of local) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}
