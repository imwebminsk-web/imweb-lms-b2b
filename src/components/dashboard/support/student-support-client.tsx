"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, SendHorizonal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createSupportTicket,
  getSupportMessages,
  getStudentTickets,
  markSupportTicketAsRead,
  sendSupportMessage,
  type SupportChatMessage,
  type SupportTicketSummary,
} from "@/app/actions/support-actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type StudentSupportClientProps = {
  userId: string;
  initialTickets: SupportTicketSummary[];
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

function statusBadge(status: string) {
  if (status === "closed") {
    return <Badge variant="secondary">Закрыто</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    >
      Открыто
    </Badge>
  );
}

function staffRoleLabel(role: SupportChatMessage["authorRole"]): string | null {
  if (role === "teacher") return "Преподаватель";
  if (role === "admin") return "Поддержка";
  return null;
}

export function StudentSupportClient({
  userId,
  initialTickets,
}: StudentSupportClientProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [ticketStatus, setTicketStatus] = useState<string>("open");
  const [draft, setDraft] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isCreating, startCreateTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null;
  const selectedHasUnreadStudent = selectedTicket?.hasUnreadStudent ?? false;

  const loadTickets = useCallback(async () => {
    const result = await getStudentTickets();
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setTickets(result.tickets);
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
      void loadTickets();
    }, 100);
  }, [loadMessages, loadTickets, selectedTicketId]);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      .channel(`support-messages:${selectedTicketId}`)
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
    if (!selectedTicketId || !selectedHasUnreadStudent) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await markSupportTicketAsRead(selectedTicketId, "student");
      if (cancelled || !result.success) {
        return;
      }
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicketId
            ? { ...ticket, hasUnreadStudent: false }
            : ticket,
        ),
      );
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTicketId, selectedHasUnreadStudent, router]);

  function handleCreateTicket(event: React.FormEvent) {
    event.preventDefault();
    startCreateTransition(async () => {
      const result = await createSupportTicket(newSubject, newMessage);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Обращение создано");
      setDialogOpen(false);
      setNewSubject("");
      setNewMessage("");
      setTickets((current) => [result.ticket, ...current]);
      setSelectedTicketId(result.ticket.id);
    });
  }

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
            ? { ...ticket, hasUnreadStudent: false }
            : ticket,
        ),
      );
      router.refresh();
      scheduleReload();
    });
  }

  const canCompose = ticketStatus !== "closed";

  return (
    <div className="flex flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Поддержка</h1>
        <p className="text-muted-foreground text-sm">
          Создайте обращение и переписывайтесь с преподавателем или администрацией.
        </p>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:min-h-[32rem] lg:grid-cols-[minmax(260px,320px)_1fr] lg:gap-6">
        <Card className="flex max-h-[min(40dvh,16rem)] flex-col lg:max-h-none">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Мои обращения</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="secondary">
                    <Plus className="mr-1 size-4" aria-hidden />
                    Новое
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateTicket}>
                    <DialogHeader>
                      <DialogTitle>Новое обращение</DialogTitle>
                      <DialogDescription>
                        Опишите проблему — мы ответим в этом чате.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="support-subject">Тема</Label>
                        <Input
                          id="support-subject"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          maxLength={200}
                          disabled={isCreating}
                          placeholder="Например: не открывается урок"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="support-initial-message">Сообщение</Label>
                        <Textarea
                          id="support-initial-message"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          maxLength={2000}
                          disabled={isCreating}
                          rows={4}
                          placeholder="Расскажите подробнее…"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? "Отправка…" : "Создать обращение"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {tickets.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                Пока нет обращений. Нажмите «Новое», чтобы написать в поддержку.
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {ticket.hasUnreadStudent ? (
                              <div
                                className="size-2.5 shrink-0 rounded-full bg-destructive"
                                aria-label="Непрочитано"
                              />
                            ) : null}
                            <span
                              className={cn(
                                "line-clamp-2 text-sm",
                                ticket.hasUnreadStudent
                                  ? "font-semibold"
                                  : "font-medium",
                              )}
                            >
                              {ticket.subject}
                            </span>
                          </div>
                          {statusBadge(ticket.status)}
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatTicketDate(ticket.updatedAt)}
                        </p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                  {statusBadge(selectedTicket.status)}
                </div>
                <CardDescription>
                  Создано {formatTicketDate(selectedTicket.createdAt)}
                </CardDescription>
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
                              ) : null}
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
                      placeholder="Напишите сообщение…"
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
                    Обращение закрыто. Новые сообщения отправить нельзя.
                  </p>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
              Выберите обращение слева или создайте новое.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
