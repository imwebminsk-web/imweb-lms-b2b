import type { ReactNode } from "react";

import { GlobalChatListener } from "@/components/providers/global-chat-listener";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GlobalChatListener />
      {children}
    </>
  );
}
