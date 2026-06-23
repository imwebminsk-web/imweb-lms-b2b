import type { ReactNode } from "react";

import { GlobalChatListener } from "@/components/providers/global-chat-listener";
import { LanguageProvider } from "@/components/providers/language-provider";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider role="student">
      <GlobalChatListener />
      <div className="h-full overflow-hidden">{children}</div>
    </LanguageProvider>
  );
}
