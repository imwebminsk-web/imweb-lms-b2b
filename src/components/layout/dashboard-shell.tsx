"use client";

import { useState, type ReactNode } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardTopnav } from "@/components/layout/dashboard-topnav";
import { LanguageProvider } from "@/components/providers/language-provider";
import type { ProfileRole } from "@/lib/dashboard/sidebar-nav";

export type DashboardShellUser = {
  name: string;
  email: string;
  avatar: string;
};

export type DashboardShellProps = {
  children: ReactNode;
  user: DashboardShellUser;
  role: ProfileRole;
  navBadges?: Record<string, number>;
  navPendingBadges?: Record<string, number>;
};

export function DashboardShell({
  children,
  user,
  role,
  navBadges,
  navPendingBadges,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <LanguageProvider role={role}>
      <div className="flex h-screen overflow-hidden bg-growvy-body">
        <DashboardSidebar
          role={role}
          user={user}
          isCollapsed={!isSidebarOpen}
          navBadges={navBadges}
          navPendingBadges={navPendingBadges}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardTopnav
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            role={role}
          />
          <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </LanguageProvider>
  );
}
