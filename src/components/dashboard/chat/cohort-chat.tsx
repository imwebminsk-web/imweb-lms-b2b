"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SendHorizonal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteChatMessage,
  getCohortMessages,
  sendChatMessage,
  type CohortChatMessage,
} from "@/app/actions/chat-actions";
import { markChatAsRead } from "@/app/actions/chat-receipt-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type CohortChatProps = {
  cohortId: string;
  currentUserId: string;
  teacherId: string;
  isChatEnabled: boolean;
  isTeacher: boolean;
  title?: string;
  description?: string;
};

const DEFAULT_CHAT_TITLE = "Чат группы";
const DEFAULT_CHAT_DESCRIPTION =
  "Обсуждение курса с преподавателем и одногруппниками";

function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const timePart = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMessageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) /
      (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return `Сегодня, ${timePart}`;
  }
  if (diffDays === 1) {
    return `Вчера, ${timePart}`;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}.${month}.${year}, ${timePart}`;
}

export function CohortChat({
  cohortId,
  currentUserId,
  teacherId,
  isChatEnabled,
  isTeacher,
  title = DEFAULT_CHAT_TITLE,
  description = DEFAULT_CHAT_DESCRIPTION,
}: CohortChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<CohortChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCompose = isChatEnabled || isTeacher;

  const loadMessages = useCallback(
    async (withLoading = false) => {
      if (withLoading) {
        setIsLoading(true);
      }

      const result = await getCohortMessages(cohortId);
      if (!result.success) {
        toast.error(result.error);
        if (withLoading) {
          setIsLoading(false);
        }
        return;
      }

      setMessages(result.messages);
      if (withLoading) {
        setIsLoading(false);
      }
    },
    [cohortId],
  );

  const markReadAndRefresh = useCallback(async () => {
    const result = await markChatAsRead(cohortId);
    if (result.success) {
      router.refresh();
    }
  }, [cohortId, router]);

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = setTimeout(() => {
      void loadMessagesRef.current(false);
      void markReadAndRefresh();
    }, 100);
  }, [markReadAndRefresh]);

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
    void (async () => {
      await loadMessages(true);
      await markReadAndRefresh();
    })();
  }, [loadMessages, markReadAndRefresh]);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `cohort-messages:${cohortId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cohort_messages",
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          console.log("Realtime Payload received:", payload);
          scheduleReload();
        },
      )
      .subscribe((status, err) => {
        console.log("Realtime Status:", status, err);
      });

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [cohortId, scheduleReload]);

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isPending || !canCompose) {
      return;
    }

    startTransition(async () => {
      const result = await sendChatMessage(cohortId, text);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      scheduleReload();
    });
  }

  function handleDeleteMessage(messageId: string) {
    setDeletingId(messageId);
    const previousMessages = messages;
    setMessages((current) => current.filter((message) => message.id !== messageId));

    startTransition(async () => {
      const result = await deleteChatMessage(messageId);
      setDeletingId(null);
      if (!result.success) {
        setMessages(previousMessages);
        toast.error(result.error);
        return;
      }
      toast.success("Сообщение удалено");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col p-4 pt-0">
        <div className="flex h-[min(calc(100dvh-16rem),32rem)] min-h-[14rem] flex-col overflow-hidden rounded-lg border">
          <div
            ref={scrollRef}
            className="bg-muted/30 min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
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
                    "flex max-w-[85%] flex-col gap-1",
                    isOwn ? "ml-auto items-end" : "mr-auto items-start",
                  )}
                >
                  <div className="group flex flex-row items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={message.authorAvatarUrl ?? undefined}
                        alt={message.authorName}
                      />
                      <AvatarFallback className="text-xs">
                        {initialsFromDisplayName(message.authorName)}
                      </AvatarFallback>
                    </Avatar>
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
                        {formatMessageDate(message.createdAt)}
                      </time>
                    </div>
                    {isTeacher ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label="Удалить сообщение"
                        disabled={isPending || deletingId === message.id}
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
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
              );
            })
          )}
          </div>

          {canCompose ? (
            <form
              onSubmit={handleSend}
              className="border-border bg-background flex shrink-0 gap-2 border-t p-3"
            >
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
          ) : (
            <p className="text-muted-foreground shrink-0 border-t py-4 text-center text-sm">
              Чат отключен преподавателем
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
