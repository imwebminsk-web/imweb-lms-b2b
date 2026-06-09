"use client";

import { useState, type ReactNode } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardTopnav } from "@/components/layout/dashboard-topnav";
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
    <div className="flex min-h-screen bg-growvy-body">
      <DashboardSidebar
        role={role}
        user={user}
        isCollapsed={!isSidebarOpen}
        navBadges={navBadges}
        navPendingBadges={navPendingBadges}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardTopnav
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
