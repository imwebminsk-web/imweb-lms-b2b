"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SendHorizonal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  closeSupportTicket,
  deleteSupportTicket,
  getAllSupportTickets,
  getSupportMessages,
  markSupportTicketAsRead,
  sendSupportMessage,
  type SupportChatMessage,
  type SupportTicketInboxItem,
} from "@/app/actions/support-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type TeacherSupportClientProps = {
  userId: string;
  initialTickets: SupportTicketInboxItem[];
  initialFilter: "open" | "closed";
};

function formatTicketDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function staffRoleLabel(role: SupportChatMessage["authorRole"]): string | null {
  if (role === "teacher") return "Преподаватель";
  if (role === "admin") return "Поддержка";
  return null;
}

export function TeacherSupportClient({
  userId,
  initialTickets,
  initialFilter,
}: TeacherSupportClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "closed">(initialFilter);
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [ticketStatus, setTicketStatus] = useState<string>("open");
  const [draft, setDraft] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isClosing, startCloseTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null;
  const selectedHasUnreadTeacher = selectedTicket?.hasUnreadTeacher ?? false;

  const loadTickets = useCallback(async (status: "open" | "closed") => {
    setIsLoadingTickets(true);
    const result = await getAllSupportTickets(status);
    setIsLoadingTickets(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setTickets(result.tickets);
    setSelectedTicketId((current) => {
      if (current && result.tickets.some((ticket) => ticket.id === current)) {
        return current;
      }
      return result.tickets[0]?.id ?? null;
    });
  }, []);

  const loadMessages = useCallback(
    async (ticketId: string, withLoading = false) => {
      if (withLoading) {
        setIsLoadingMessages(true);
      }

      const result = await getSupportMessages(ticketId);
      if (!result.success) {
        toast.error(result.error);
        if (withLoading) {
          setIsLoadingMessages(false);
        }
        return;
      }

      setMessages(result.messages);
      setTicketStatus(result.ticketStatus);
      if (withLoading) {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  const scheduleReload = useCallback(() => {
    if (!selectedTicketId) return;
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = setTimeout(() => {
      void loadMessages(selectedTicketId, false);
      void loadTickets(filter);
    }, 100);
  }, [filter, loadMessages, loadTickets, selectedTicketId]);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    void loadTickets(filter);
  }, [filter, loadTickets]);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedTicketId, true);
  }, [selectedTicketId, loadMessages]);

  useEffect(() => {
    if (!selectedTicketId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`teacher-support-messages:${selectedTicketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        () => {
          scheduleReload();
        },
      )
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [selectedTicketId, scheduleReload]);

  useEffect(() => {
    if (!selectedTicketId || !selectedHasUnreadTeacher) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await markSupportTicketAsRead(selectedTicketId, "teacher");
      if (cancelled || !result.success) {
        return;
      }
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicketId
            ? { ...ticket, hasUnreadTeacher: false }
            : ticket,
        ),
      );
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTicketId, selectedHasUnreadTeacher, router]);

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTicketId) return;
    const text = draft.trim();
    if (!text || isPending) return;

    startTransition(async () => {
      const result = await sendSupportMessage(selectedTicketId, text);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicketId
            ? { ...ticket, hasUnreadTeacher: false }
            : ticket,
        ),
      );
      router.refresh();
      scheduleReload();
    });
  }

  function handleCloseTicket() {
    if (!selectedTicketId) return;

    startCloseTransition(async () => {
      const result = await closeSupportTicket(selectedTicketId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Обращение закрыто");
      setTicketStatus("closed");
      if (filter === "open") {
        setSelectedTicketId(null);
      }
      await loadTickets(filter);
      router.refresh();
    });
  }

  function handleDeleteTicket() {
    if (!selectedTicketId) return;

    startDeleteTransition(async () => {
      const result = await deleteSupportTicket(selectedTicketId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Обращение удалено");
      setSelectedTicketId(null);
      await loadTickets(filter);
      router.refresh();
    });
  }

  const canCompose = ticketStatus !== "closed";

  return (
    <div className="flex flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Обращения в поддержку
        </h1>
        <p className="text-muted-foreground text-sm">
          Отвечайте ученикам и закрывайте решённые обращения.
        </p>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:min-h-[32rem] lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-6">
        <Card className="flex max-h-[min(40dvh,16rem)] flex-col lg:max-h-none">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Входящие</CardTitle>
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as "open" | "closed")}
            >
              <TabsList className="mt-2 w-full">
                <TabsTrigger value="open" className="flex-1">
                  Открытые
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex-1">
                  Закрытые
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {isLoadingTickets ? (
              <p className="text-muted-foreground p-4 text-sm">Загрузка…</p>
            ) : tickets.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                {filter === "open"
                  ? "Нет открытых обращений."
                  : "Нет закрытых обращений."}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {tickets.map((ticket) => {
                  const active = ticket.id === selectedTicketId;
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={cn(
                          "hover:bg-muted/50 w-full px-4 py-3 text-left transition-colors",
                          active && "bg-muted",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage
                              src={ticket.studentAvatarUrl ?? undefined}
                              alt={ticket.studentName}
                            />
                            <AvatarFallback className="text-xs">
                              {initialsFromDisplayName(ticket.studentName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {ticket.studentName}
                            </p>
                            <div className="flex items-center gap-2">
                              {ticket.hasUnreadTeacher ? (
                                <div
                                  className="size-2.5 shrink-0 rounded-full bg-destructive"
                                  aria-label="Непрочитано"
                                />
                              ) : null}
                              <p
                                className={cn(
                                  "line-clamp-2 min-w-0 flex-1 text-sm",
                                  ticket.hasUnreadTeacher
                                    ? "font-semibold"
                                    : undefined,
                                )}
                              >
                                {ticket.subject}
                              </p>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {formatTicketDate(ticket.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[min(calc(100dvh-14rem),36rem)] flex-col lg:min-h-[32rem]">
          {selectedTicket ? (
            <>
              <CardHeader className="shrink-0 border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        {selectedTicket.subject}
                      </CardTitle>
                      {ticketStatus === "closed" ? (
                        <Badge variant="secondary">Закрыто</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        >
                          Открыто
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={selectedTicket.studentAvatarUrl ?? undefined}
                          alt={selectedTicket.studentName}
                        />
                        <AvatarFallback className="text-[10px]">
                          {initialsFromDisplayName(selectedTicket.studentName)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedTicket.studentName}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canCompose ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isClosing || isPending || isDeleting}
                        onClick={handleCloseTicket}
                      >
                        {isClosing ? "Закрытие…" : "Закрыть обращение"}
                      </Button>
                    ) : null}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          disabled={isClosing || isPending || isDeleting}
                          aria-label="Удалить обращение"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить обращение?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Это действие необратимо. Обращение и все сообщения
                            будут удалены без возможности восстановления.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteTicket}
                            disabled={isDeleting}
                            className={buttonVariants({ variant: "destructive" })}
                          >
                            {isDeleting ? "Удаление…" : "Удалить"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
                <div
                  ref={scrollRef}
                  className="bg-muted/30 mx-4 mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border p-4"
                  aria-live="polite"
                  aria-busy={isLoadingMessages}
                >
                  {isLoadingMessages ? (
                    <p className="text-muted-foreground text-sm">
                      Загрузка сообщений…
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Сообщений пока нет.
                    </p>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.senderId === userId;
                      const staffLabel = staffRoleLabel(message.authorRole);
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex max-w-[85%] flex-col gap-1",
                            isOwn ? "ml-auto items-end" : "mr-auto items-start",
                          )}
                        >
                          <div className="flex flex-row items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage
                                src={message.authorAvatarUrl ?? undefined}
                                alt={message.authorName}
                              />
                              <AvatarFallback className="text-xs">
                                {initialsFromDisplayName(message.authorName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span className="font-medium text-foreground">
                                {message.authorName}
                              </span>
                              {staffLabel ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {staffLabel}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  Ученик
                                </Badge>
                              )}
                              <time dateTime={message.createdAt}>
                                {formatMessageTime(message.createdAt)}
                              </time>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-break-word",
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-card border rounded-bl-md",
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
                    className="border-border bg-background flex shrink-0 gap-2 border-t p-4"
                  >
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Напишите ответ…"
                      maxLength={2000}
                      disabled={isPending || isLoadingMessages}
                      autoComplete="off"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={
                        isPending || isLoadingMessages || draft.trim().length === 0
                      }
                      aria-label="Отправить сообщение"
                    >
                      <SendHorizonal className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <p className="text-muted-foreground shrink-0 border-t py-4 text-center text-sm">
                    Обращение закрыто. Ответы недоступны.
                  </p>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
              Выберите обращение из списка слева.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
