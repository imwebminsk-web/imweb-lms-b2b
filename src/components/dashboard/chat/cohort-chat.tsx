"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import {
  getCohortMessages,
  sendChatMessage,
  type CohortChatMessage,
} from "@/app/actions/chat-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";
import type { Database } from "@/types/database.types";

type CohortChatProps = {
  cohortId: string;
  currentUserId: string;
  teacherId: string;
};

type RealtimeMessageRow = Database["public"]["Tables"]["cohort_messages"]["Row"];

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function CohortChat({
  cohortId,
  currentUserId,
  teacherId,
}: CohortChatProps) {
  const [messages, setMessages] = useState<CohortChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());

  const appendMessage = useCallback((message: CohortChatMessage) => {
    if (messageIdsRef.current.has(message.id)) {
      return;
    }
    messageIdsRef.current.add(message.id);
    setMessages((prev) => [...prev, message]);
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      setIsLoading(true);
      const result = await getCohortMessages(cohortId);
      if (cancelled) {
        return;
      }
      if (!result.success) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }
      messageIdsRef.current = new Set(result.messages.map((m) => m.id));
      setMessages(result.messages);
      setIsLoading(false);
    }

    void loadInitialMessages();

    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  useEffect(() => {
    const supabase = createClient();

    async function enrichRealtimeRow(row: RealtimeMessageRow): Promise<CohortChatMessage> {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", row.user_id)
        .maybeSingle();

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

    const channel = supabase
      .channel(`cohort-chat:${cohortId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cohort_messages",
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          void enrichRealtimeRow(row).then((message) => {
            appendMessage(message);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appendMessage, cohortId]);

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await sendChatMessage(cohortId, text);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      appendMessage(result.message);
      setDraft("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Чат группы</CardTitle>
        <CardDescription>
          Общение с учениками группы в реальном времени.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={scrollRef}
          className="bg-muted/30 h-96 space-y-3 overflow-y-auto rounded-lg border p-4"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Загрузка сообщений…</p>
          ) : messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Пока нет сообщений. Напишите первым!
            </p>
          ) : (
            messages.map((message) => {
              const isOwn = message.userId === currentUserId;
              const isTeacherMessage = message.userId === teacherId;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    isOwn ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <Avatar size="sm">
                    {message.authorAvatarUrl ? (
                      <AvatarImage
                        src={message.authorAvatarUrl}
                        alt={message.authorName}
                      />
                    ) : null}
                    <AvatarFallback>
                      {initialsFromName(message.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "flex max-w-[75%] min-w-0 flex-col gap-1",
                      isOwn ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs",
                        isOwn ? "justify-end" : "justify-start",
                      )}
                    >
                      <span className="font-medium break-words text-foreground">
                        {message.authorName}
                      </span>
                      {isTeacherMessage ? (
                        <Badge
                          variant="secondary"
                          className="border-primary/20 bg-primary/10 text-primary shrink-0 text-[10px] uppercase tracking-wide"
                        >
                          Преподаватель
                        </Badge>
                      ) : null}
                      <time dateTime={message.createdAt} className="shrink-0">
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-break-word",
                        isTeacherMessage
                          ? "border border-primary/20 bg-primary/10 text-foreground rounded-bl-md"
                          : isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-card border rounded-bl-md",
                        isOwn && isTeacherMessage && "rounded-br-md rounded-bl-2xl",
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Напишите сообщение…"
            maxLength={2000}
            disabled={isPending || isLoading}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending || isLoading || draft.trim().length === 0}
            aria-label="Отправить сообщение"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
