"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const GLOBAL_CHANNEL_NAME = "global-cohort-messages";

export function GlobalChatListener() {
  const router = useRouter();
  const currentUserIdRef = useRef<string | null>(null);

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

      currentUserIdRef.current = user.id;

      if (cancelled) {
        return;
      }

      const nextChannel = supabase
        .channel(GLOBAL_CHANNEL_NAME)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "cohort_messages",
          },
          (payload) => {
            const row = payload.new as { user_id?: string } | null;
            if (row?.user_id && row.user_id !== currentUserIdRef.current) {
              const audio = new Audio("/pop.mp3");
              audio.play().catch((err) =>
                console.warn("Audio play blocked by browser:", err),
              );
              router.refresh();
            }
          },
        )
        .subscribe((status, err) => {
          console.log("Global Realtime Status:", status, err);
        });

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
  }, [router]);

  return null;
}
