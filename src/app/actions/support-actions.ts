"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

export type SupportTicketSummary = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  hasUnreadTeacher: boolean;
  hasUnreadStudent: boolean;
};

export type SupportTicketInboxItem = SupportTicketSummary & {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
};

export type SupportChatMessage = {
  id: string;
  ticketId: string;
  senderId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: ProfileRole;
};

export type CreateSupportTicketResult =
  | { success: true; ticket: SupportTicketSummary }
  | { success: false; error: string };

export type GetStudentTicketsResult =
  | { success: true; tickets: SupportTicketSummary[] }
  | { success: false; error: string };

export type GetAllSupportTicketsResult =
  | { success: true; tickets: SupportTicketInboxItem[] }
  | { success: false; error: string };

export type CloseSupportTicketResult =
  | { success: true }
  | { success: false; error: string };

export type GetSupportMessagesResult =
  | { success: true; messages: SupportChatMessage[]; ticketStatus: string }
  | { success: false; error: string };

export type SendSupportMessageResult =
  | { success: true; message: SupportChatMessage }
  | { success: false; error: string };

export type DeleteSupportTicketResult =
  | { success: true }
  | { success: false; error: string };

export type MarkSupportTicketAsReadResult =
  | { success: true }
  | { success: false; error: string };

export type GetSupportUnreadCountResult =
  | { success: true; count: number }
  | { success: false; error: string };

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;

type RawMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: ProfileRole;
};

function mapTicketRow(row: {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  has_unread_teacher: boolean;
  has_unread_student: boolean;
}): SupportTicketSummary {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasUnreadTeacher: row.has_unread_teacher,
    hasUnreadStudent: row.has_unread_student,
  };
}

async function fetchProfilesByUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ProfileRow>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .in("id", uniqueIds);

  if (error) {
    console.error("[support-actions] profiles", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row as ProfileRow);
  }

  return map;
}

function mapMessageRow(
  row: RawMessageRow,
  profile: ProfileRow | undefined,
): SupportChatMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    authorName: resolveStudentDisplayName(
      profile?.full_name,
      null,
      row.sender_id,
    ),
    authorAvatarUrl: profile?.avatar_url ?? null,
    authorRole: profile?.role ?? "student",
  };
}

async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Нужна авторизация." };
  }

  return { ok: true as const, supabase, user };
}

function isStaffRole(role: ProfileRole | undefined): boolean {
  return role === "teacher" || role === "admin";
}

async function getProfileRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ProfileRole | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[support-actions] profile role", error.message);
    return null;
  }

  return profile?.role ?? null;
}

async function assertTicketAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticketId: string,
  userId: string,
  userRole: ProfileRole | null,
): Promise<
  | { ok: true; status: string }
  | { ok: false; error: string }
> {
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    console.error("[support-actions] ticket", error.message);
    return { ok: false, error: "Не удалось загрузить обращение." };
  }

  if (!ticket) {
    return { ok: false, error: "Обращение не найдено." };
  }

  if (isStaffRole(userRole ?? undefined) || ticket.user_id === userId) {
    return { ok: true, status: ticket.status };
  }

  return { ok: false, error: "Обращение не найдено." };
}

async function requireStaffUser() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return auth;
  }

  const role = await getProfileRole(auth.supabase, auth.user.id);
  if (!isStaffRole(role ?? undefined)) {
    return { ok: false as const, error: "Нет доступа." };
  }

  return { ok: true as const, supabase: auth.supabase, user: auth.user, role };
}

function requireSupportRpcClient():
  | NonNullable<ReturnType<typeof createAdminClient>>
  | { success: false; error: string } {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      success: false,
      error:
        "Сервер не настроен для обновления тикетов (отсутствует SUPABASE_SERVICE_ROLE_KEY).",
    };
  }
  return adminClient;
}

/** Список всех тикетов для учителя или админа. */
export async function getAllSupportTickets(
  status?: "open" | "closed",
): Promise<GetAllSupportTicketsResult> {
  const staff = await requireStaffUser();
  if (!staff.ok) {
    return { success: false, error: staff.error };
  }

  const { supabase } = staff;

  let query = supabase
    .from("support_tickets")
    .select(
      "id, user_id, subject, status, created_at, updated_at, has_unread_teacher, has_unread_student",
    )
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAllSupportTickets]", error.message);
    return { success: false, error: "Не удалось загрузить обращения." };
  }

  const rows = data ?? [];
  const studentProfiles = await fetchProfilesByUserIds(
    supabase,
    rows.map((row) => row.user_id),
  );

  const tickets: SupportTicketInboxItem[] = rows.map((row) => {
    const studentProfile = studentProfiles.get(row.user_id);
    return {
      ...mapTicketRow(row),
      studentId: row.user_id,
      studentName: resolveStudentDisplayName(
        studentProfile?.full_name,
        null,
        row.user_id,
      ),
      studentAvatarUrl: studentProfile?.avatar_url ?? null,
    };
  });

  return { success: true, tickets };
}

/** Закрывает обращение (учитель или админ). */
export async function closeSupportTicket(
  ticketId: string,
): Promise<CloseSupportTicketResult> {
  const tid = ticketId.trim();
  if (!tid) {
    return { success: false, error: "Не указано обращение." };
  }

  const staff = await requireStaffUser();
  if (!staff.ok) {
    return { success: false, error: staff.error };
  }

  const { supabase } = staff;

  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "closed" })
    .eq("id", tid);

  if (error) {
    console.error("[closeSupportTicket]", error.message);
    return { success: false, error: "Не удалось закрыть обращение." };
  }

  revalidatePath("/dashboard/support");
  return { success: true };
}

/** Удаляет обращение (учитель или админ). */
export async function deleteSupportTicket(
  ticketId: string,
): Promise<DeleteSupportTicketResult> {
  const tid = ticketId.trim();
  if (!tid) {
    return { success: false, error: "Не указано обращение." };
  }

  const staff = await requireStaffUser();
  if (!staff.ok) {
    return { success: false, error: staff.error };
  }

  const { supabase } = staff;

  const { error } = await supabase.from("support_tickets").delete().eq("id", tid);

  if (error) {
    console.error("[deleteSupportTicket]", error.message);
    return { success: false, error: "Не удалось удалить обращение." };
  }

  revalidatePath("/dashboard/support");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Сбрасывает флаг непрочитанного для ученика или преподавателя. */
export async function markSupportTicketAsRead(
  ticketId: string,
  role: "student" | "teacher",
): Promise<MarkSupportTicketAsReadResult> {
  const tid = ticketId.trim();
  if (!tid) {
    return { success: false, error: "Не указано обращение." };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;
  const userRole = await getProfileRole(supabase, user.id);

  if (role === "teacher") {
    if (!isStaffRole(userRole ?? undefined)) {
      return { success: false, error: "Нет доступа." };
    }

    const adminClient = requireSupportRpcClient();
    if ("success" in adminClient) {
      return adminClient;
    }

    const { error } = await adminClient.rpc("mark_support_ticket_read", {
      p_ticket_id: tid,
      p_role: "teacher",
    });

    if (error) {
      console.error("[markSupportTicketAsRead] teacher", error.message);
      return { success: false, error: "Не удалось отметить прочитанным." };
    }
  } else {
    const access = await assertTicketAccess(supabase, tid, user.id, userRole);
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const adminClient = requireSupportRpcClient();
    if ("success" in adminClient) {
      return adminClient;
    }

    const { error } = await adminClient.rpc("mark_support_ticket_read", {
      p_ticket_id: tid,
      p_role: "student",
    });

    if (error) {
      console.error("[markSupportTicketAsRead] student", error.message);
      return { success: false, error: "Не удалось отметить прочитанным." };
    }
  }

  revalidatePath("/dashboard/support");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Число непрочитанных обращений для бейджа в навигации. */
export async function getSupportUnreadCount(): Promise<GetSupportUnreadCountResult> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;
  const userRole = await getProfileRole(supabase, user.id);

  if (!userRole) {
    return { success: false, error: "Профиль не найден." };
  }

  if (userRole === "student") {
    const { count, error } = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("has_unread_student", true);

    if (error) {
      console.error("[getSupportUnreadCount] student", error.message);
      return { success: false, error: "Не удалось загрузить счётчик." };
    }

    return { success: true, count: count ?? 0 };
  }

  if (isStaffRole(userRole)) {
    const { count, error } = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("has_unread_teacher", true)
      .eq("status", "open");

    if (error) {
      console.error("[getSupportUnreadCount] staff", error.message);
      return { success: false, error: "Не удалось загрузить счётчик." };
    }

    return { success: true, count: count ?? 0 };
  }

  return { success: true, count: 0 };
}

/** Создаёт тикет поддержки и первое сообщение от ученика. */
export async function createSupportTicket(
  subject: string,
  initialMessage: string,
): Promise<CreateSupportTicketResult> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;
  const trimmedSubject = subject.trim();
  const trimmedMessage = initialMessage.trim();

  if (!trimmedSubject) {
    return { success: false, error: "Введите тему обращения." };
  }
  if (trimmedSubject.length > MAX_SUBJECT_LENGTH) {
    return {
      success: false,
      error: `Тема не длиннее ${MAX_SUBJECT_LENGTH} символов.`,
    };
  }
  if (!trimmedMessage) {
    return { success: false, error: "Введите текст сообщения." };
  }
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `Сообщение не длиннее ${MAX_MESSAGE_LENGTH} символов.`,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден." };
  }

  if (profile.role !== "student") {
    return { success: false, error: "Создавать обращения могут только ученики." };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: trimmedSubject,
      status: "open",
    })
    .select(
      "id, subject, status, created_at, updated_at, has_unread_teacher, has_unread_student",
    )
    .single();

  if (ticketError || !ticket) {
    console.error("[createSupportTicket]", ticketError?.message);
    return { success: false, error: "Не удалось создать обращение." };
  }

  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content: trimmedMessage,
    });

  if (messageError) {
    console.error("[createSupportTicket] message", messageError.message);
    return { success: false, error: "Не удалось отправить первое сообщение." };
  }

  revalidatePath("/dashboard/support");
  revalidatePath("/", "layout");
  return { success: true, ticket: mapTicketRow(ticket) };
}

/** Список тикетов текущего ученика. */
export async function getStudentTickets(): Promise<GetStudentTicketsResult> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, subject, status, created_at, updated_at, has_unread_teacher, has_unread_student",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getStudentTickets]", error.message);
    return { success: false, error: "Не удалось загрузить обращения." };
  }

  return {
    success: true,
    tickets: (data ?? []).map(mapTicketRow),
  };
}

/** Сообщения тикета с данными профиля отправителя. */
export async function getSupportMessages(
  ticketId: string,
): Promise<GetSupportMessagesResult> {
  const tid = ticketId.trim();
  if (!tid) {
    return { success: false, error: "Не указано обращение." };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;
  const userRole = await getProfileRole(supabase, user.id);
  const access = await assertTicketAccess(supabase, tid, user.id, userRole);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { data, error } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_id, content, created_at")
    .eq("ticket_id", tid)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getSupportMessages]", error.message);
    return { success: false, error: "Не удалось загрузить сообщения." };
  }

  const rows = (data ?? []) as RawMessageRow[];
  const profiles = await fetchProfilesByUserIds(
    supabase,
    rows.map((row) => row.sender_id),
  );

  return {
    success: true,
    ticketStatus: access.status,
    messages: rows.map((row) => mapMessageRow(row, profiles.get(row.sender_id))),
  };
}

/** Отправляет сообщение в тикет и обновляет время активности. */
export async function sendSupportMessage(
  ticketId: string,
  content: string,
): Promise<SendSupportMessageResult> {
  const tid = ticketId.trim();
  const text = content.trim();

  if (!tid) {
    return { success: false, error: "Не указано обращение." };
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

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { supabase, user } = auth;
  const userRole = await getProfileRole(supabase, user.id);
  const access = await assertTicketAccess(supabase, tid, user.id, userRole);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  if (access.status === "closed") {
    return { success: false, error: "Обращение закрыто. Новые сообщения недоступны." };
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: tid,
      sender_id: user.id,
      content: text,
    })
    .select("id, ticket_id, sender_id, content, created_at")
    .single();

  if (error || !data) {
    console.error("[sendSupportMessage]", error?.message);
    return { success: false, error: "Не удалось отправить сообщение." };
  }

  const adminClient = requireSupportRpcClient();
  if ("success" in adminClient) {
    console.error("[sendSupportMessage] touch ticket", adminClient.error);
  } else {
    const { error: touchError } = await adminClient.rpc("touch_support_ticket", {
      p_ticket_id: tid,
      p_sender_role: isStaffRole(userRole ?? undefined) ? "teacher" : "student",
    });

    if (touchError) {
      console.error("[sendSupportMessage] touch ticket", touchError.message);
    }
  }

  const profiles = await fetchProfilesByUserIds(supabase, [user.id]);
  const message = mapMessageRow(data as RawMessageRow, profiles.get(user.id));

  revalidatePath("/dashboard/support");
  revalidatePath("/", "layout");
  return { success: true, message };
}
