"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth-actions";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  GrowvyCatalogIcon,
  GrowvyCoursesIcon,
  GrowvyGroupsIcon,
  GrowvyLearningIcon,
  GrowvyLogoutIcon,
  GrowvySettingsIcon,
  GrowvyStudentsIcon,
  GrowvySupportIcon,
  GrowvyTestsIcon,
} from "@/components/layout/growvy-icons";
import type { ProfileRole } from "@/lib/dashboard/sidebar-nav";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const teacherNav: NavItem[] = [
  { title: "Мои курсы", url: "/dashboard/courses", icon: GrowvyCoursesIcon },
  { title: "Группы", url: "/dashboard/cohorts", icon: GrowvyGroupsIcon },
  { title: "Ученики", url: "/dashboard/students", icon: GrowvyStudentsIcon },
  { title: "Тесты", url: "/dashboard/tests", icon: GrowvyTestsIcon },
];

const studentNav: NavItem[] = [
  { title: "Моё обучение", url: "/dashboard", icon: GrowvyLearningIcon },
  { title: "Каталог", url: "/", icon: GrowvyCatalogIcon },
  { title: "Поддержка", url: "/", icon: GrowvySupportIcon },
];

const adminNav: NavItem[] = [
  { title: "Тесты", url: "/dashboard/tests", icon: GrowvyTestsIcon },
  { title: "Финансы", url: "/dashboard", icon: GrowvyCatalogIcon },
  { title: "Все курсы", url: "/dashboard", icon: GrowvyCoursesIcon },
];

function getNavForRole(role: ProfileRole): NavItem[] {
  if (role === "teacher") return teacherNav;
  if (role === "admin") return adminNav;
  return studentNav;
}

function isActive(pathname: string, url: string): boolean {
  if (url === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

function NavBadges({
  active,
  pendingCount,
  badgeCount,
  collapsed,
}: {
  active: boolean;
  pendingCount: number;
  badgeCount: number;
  collapsed: boolean;
}) {
  if (pendingCount === 0 && badgeCount === 0) {
    return null;
  }

  if (collapsed) {
    const total = pendingCount + badgeCount;
    return (
      <span
        className={cn(
          "absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums",
          pendingCount > 0
            ? "bg-yellow-400 text-black"
            : "bg-destructive text-white",
          active && badgeCount > 0 && pendingCount === 0 && "bg-white text-growvy-primary",
        )}
        aria-hidden
      >
        {total > 9 ? "9+" : total}
      </span>
    );
  }

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {pendingCount > 0 ? (
        <Badge className="min-w-5 justify-center border-transparent bg-yellow-400 px-1.5 text-[10px] text-black hover:bg-yellow-400">
          {pendingCount}
        </Badge>
      ) : null}
      {badgeCount > 0 ? (
        <Badge
          variant="destructive"
          className={cn(
            "min-w-5 justify-center px-1.5 text-[10px] tabular-nums",
            active && "bg-white text-growvy-primary hover:bg-white",
          )}
        >
          {badgeCount}
        </Badge>
      ) : null}
    </span>
  );
}

export type DashboardSidebarUser = {
  name: string;
  email: string;
  avatar: string;
};

export type DashboardSidebarProps = {
  role: ProfileRole;
  user: DashboardSidebarUser;
  isCollapsed: boolean;
  navBadges?: Record<string, number>;
  navPendingBadges?: Record<string, number>;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function DashboardSidebar({
  role,
  user,
  isCollapsed,
  navBadges = {},
  navPendingBadges = {},
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = getNavForRole(role);

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-growvy-content py-6 transition-[width,padding] duration-200 ease-in-out",
        isCollapsed ? "w-20 px-2" : "w-[260px] px-4",
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          "mb-8 flex items-center font-bold tracking-tight transition-all",
          isCollapsed
            ? "justify-center px-0"
            : "px-3 text-2xl",
        )}
        title="New Edu"
      >
        {isCollapsed ? (
          <span className="flex size-10 items-center justify-center rounded-xl bg-growvy-primary text-sm font-bold text-white">
            N
          </span>
        ) : (
          <>
            <span className="text-growvy-primary">New</span>
            <span className="text-foreground"> Edu</span>
          </>
        )}
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.url);
          const badgeCount = navBadges[item.url] ?? 0;
          const pendingCount = navPendingBadges[item.url] ?? 0;
          const Icon = item.icon;

          return (
            <Link
              key={`${item.title}-${item.url}`}
              href={item.url}
              title={item.title}
              className={cn(
                "relative flex items-center rounded-xl text-sm font-medium transition-colors",
                isCollapsed
                  ? "justify-center px-0 py-2.5"
                  : "gap-3 px-3 py-2.5",
                active
                  ? "bg-growvy-primary text-white shadow-sm"
                  : "text-muted-foreground hover:bg-growvy-body hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!isCollapsed ? (
                <span className="flex-1 truncate">{item.title}</span>
              ) : null}
              <NavBadges
                active={active}
                pendingCount={pendingCount}
                badgeCount={badgeCount}
                collapsed={isCollapsed}
              />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
        <div
          className={cn(
            "mb-2 flex items-center rounded-xl border border-border bg-growvy-body",
            isCollapsed
              ? "justify-center px-0 py-2"
              : "gap-3 px-3 py-2.5",
          )}
          title={user.name}
        >
          <Avatar className="size-9 shrink-0 rounded-full">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-full bg-growvy-primary/10 text-xs font-semibold text-growvy-primary">
              {initialsFromName(user.name)}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed ? (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center py-1" : "justify-between gap-2 px-3 py-1",
          )}
        >
          {!isCollapsed ? (
            <span className="text-sm font-medium text-muted-foreground">Тема</span>
          ) : null}
          <ModeToggle />
        </div>

        <Link
          href="/dashboard/settings"
          title="Настройки"
          className={cn(
            "flex items-center rounded-xl text-sm font-medium transition-colors",
            isCollapsed
              ? "justify-center px-0 py-2.5"
              : "gap-3 px-3 py-2.5",
            pathname.startsWith("/dashboard/settings")
              ? "bg-growvy-primary text-white"
              : "text-muted-foreground hover:bg-growvy-body hover:text-foreground",
          )}
        >
          <GrowvySettingsIcon className="size-5 shrink-0" />
          {!isCollapsed ? <span>Настройки</span> : null}
        </Link>

        <form action={signOut} className="w-full">
          <button
            type="submit"
            title="Выйти"
            className={cn(
              "flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-growvy-body hover:text-foreground",
              isCollapsed
                ? "justify-center px-0 py-2.5"
                : "gap-3 px-3 py-2.5",
            )}
          >
            <GrowvyLogoutIcon className="size-5 shrink-0" />
            {!isCollapsed ? <span>Выйти</span> : null}
          </button>
        </form>
      </div>
    </aside>
  );
}
