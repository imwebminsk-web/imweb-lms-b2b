import type { ReactNode } from "react";

import { GlobalChatListener } from "@/components/providers/global-chat-listener";
import { LanguageProvider } from "@/components/providers/language-provider";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider role="student">
      <GlobalChatListener />
      <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain">
        {children}
      </div>
    </LanguageProvider>
  );
}
