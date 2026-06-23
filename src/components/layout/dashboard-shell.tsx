"use client";

import { useState, type ReactNode } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardTopnav } from "@/components/layout/dashboard-topnav";
import { LanguageProvider } from "@/components/providers/language-provider";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <LanguageProvider role={role}>
      <div className="flex h-full w-full overflow-hidden bg-growvy-body">
        <DashboardSidebar
          role={role}
          user={user}
          isCollapsed={!isSidebarOpen}
          navBadges={navBadges}
          navPendingBadges={navPendingBadges}
          className="hidden lg:flex"
        />

        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-[min(100vw,260px)] max-w-[260px] gap-0 border-r border-border bg-growvy-content p-0 sm:max-w-[260px]"
          >
            <SheetTitle className="sr-only">Навигация по личному кабинету</SheetTitle>
            <DashboardSidebar
              embedded
              role={role}
              user={user}
              isCollapsed={false}
              navBadges={navBadges}
              navPendingBadges={navPendingBadges}
              onNavigate={() => setIsMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardTopnav
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            role={role}
          />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}
