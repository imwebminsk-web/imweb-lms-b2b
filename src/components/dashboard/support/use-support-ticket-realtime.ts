"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  appendSupportRealtimeMessage,
  type SupportRealtimeRow,
} from "@/components/dashboard/support/append-realtime-message";
import type { SupportChatMessage } from "@/app/actions/support-actions";

type UseSupportTicketRealtimeArgs = {
  ticketId: string | null;
  userId: string;
  onMessage: Dispatch<SetStateAction<SupportChatMessage[]>>;
  onClosed: (ticketId: string) => void;
};

export function useSupportTicketRealtime({
  ticketId,
  userId,
  onMessage,
  onClosed,
}: UseSupportTicketRealtimeArgs) {
  useEffect(() => {
    if (!ticketId) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`support-ticket:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const row = payload.new as SupportRealtimeRow | null;
          if (!row) return;
          onMessage((prev) => appendSupportRealtimeMessage(prev, row, userId));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string } | null;
          if (row?.status === "closed") {
            onClosed(ticketId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, userId, onMessage, onClosed]);
}
