"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { useSupportUnread } from "@/components/providers/support-unread-provider";

const GLOBAL_SUPPORT_CHANNEL_NAME = "global-support-messages";

export function GlobalSupportListener() {
  const { refreshCount } = useSupportUnread();
  const currentUserIdRef = useRef<string | null>(null);
  const refreshCountRef = useRef(refreshCount);
  refreshCountRef.current = refreshCount;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || profile?.role === "teacher") {
        return;
      }

      currentUserIdRef.current = user.id;

      const nextChannel = supabase
        .channel(GLOBAL_SUPPORT_CHANNEL_NAME)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_messages",
          },
          (payload) => {
            const row = payload.new as { sender_id?: string } | null;
            if (row?.sender_id && row.sender_id !== currentUserIdRef.current) {
              void refreshCountRef.current();
            }
          },
        )
        .subscribe();

      if (cancelled) {
        void supabase.removeChannel(nextChannel);
        return;
      }

      channel = nextChannel;
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return null;
}
