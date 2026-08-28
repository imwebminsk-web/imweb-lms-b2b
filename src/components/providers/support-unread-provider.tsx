"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getSupportUnreadCount } from "@/app/actions/support-actions";

export const SUPPORT_NAV_URL = "/dashboard/support";

type SupportUnreadContextValue = {
  count: number;
  refreshCount: () => Promise<void>;
};

const SupportUnreadContext = createContext<SupportUnreadContextValue | null>(
  null,
);

export function SupportUnreadProvider({
  children,
  initialCount,
}: {
  children: ReactNode;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);

  const refreshCount = useCallback(async () => {
    const result = await getSupportUnreadCount();
    if (result.success) {
      setCount(result.count);
    }
  }, []);

  const value = useMemo(
    () => ({ count, refreshCount }),
    [count, refreshCount],
  );

  return (
    <SupportUnreadContext.Provider value={value}>
      {children}
    </SupportUnreadContext.Provider>
  );
}

export function useSupportUnread(): SupportUnreadContextValue {
  const context = useContext(SupportUnreadContext);
  if (!context) {
    throw new Error("useSupportUnread must be used within SupportUnreadProvider");
  }
  return context;
}
