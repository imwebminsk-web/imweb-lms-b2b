"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"

import { signOut } from "@/app/actions/auth-actions"
import { useLanguage } from "@/components/providers/language-provider"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/ui/logo"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  GrowvyCatalogIcon,
  GrowvyCoursesIcon,
  GrowvyDictionariesIcon,
  GrowvyGroupsIcon,
  GrowvyLearningIcon,
  GrowvyLogoutIcon,
  GrowvyStudentsIcon,
  GrowvySupportIcon,
  GrowvyTestsIcon,
} from "@/components/layout/growvy-icons";
import type { ProfileRole } from "@/lib/dashboard/sidebar-nav";
import type { TranslationKey } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  labelKey?: TranslationKey;
  url: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const teacherNav: NavItem[] = [
  { title: "Мои курсы", url: "/dashboard/courses", icon: GrowvyCoursesIcon },
  { title: "Группы", url: "/dashboard/cohorts", icon: GrowvyGroupsIcon },
  { title: "Ученики", url: "/dashboard/students", icon: GrowvyStudentsIcon },
  { title: "Тесты", url: "/dashboard/tests", icon: GrowvyTestsIcon },
  { title: "Поддержка", url: "/dashboard/support", icon: GrowvySupportIcon },
];

const studentNav: NavItem[] = [
  {
    title: "Моё обучение",
    labelKey: "nav.myLearning",
    url: "/dashboard",
    icon: GrowvyLearningIcon,
  },
  {
    title: "Каталог",
    labelKey: "nav.catalog",
    url: "/",
    icon: GrowvyCatalogIcon,
  },
  {
    title: "Поддержка",
    labelKey: "nav.support",
    url: "/dashboard/support",
    icon: GrowvySupportIcon,
  },
];

const adminNav: NavItem[] = [
  { title: "Главная", url: "/dashboard", icon: GrowvyCatalogIcon },
  {
    title: "Справочники",
    url: "/dashboard/admin/taxonomies",
    icon: GrowvyDictionariesIcon,
  },
  { title: "Поддержка", url: "/dashboard/support", icon: GrowvySupportIcon },
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
  /** Доп. классы обёртки (desktop: `hidden lg:flex`). */
  className?: string;
  /** Внутри Sheet на мобильных — без `<aside>`. */
  embedded?: boolean;
  /** Закрыть мобильное меню после перехода по ссылке. */
  onNavigate?: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function DashboardSidebarPanel({
  role,
  user,
  isCollapsed,
  navBadges = {},
  navPendingBadges = {},
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const items = getNavForRole(role);

  function navLabel(item: NavItem): string {
    if (role === "student" && item.labelKey) {
      return t(item.labelKey);
    }
    return item.title;
  }

  function handleNavigate() {
    onNavigate?.();
  }

  return (
    <>
      <Link
        href="/dashboard"
        onClick={handleNavigate}
        className={cn(
          "mb-8 flex shrink-0 items-center transition-all",
          isCollapsed ? "justify-center overflow-hidden px-0" : "px-3",
        )}
        title="New Education"
      >
        <Logo
          className={cn(
            "max-w-full object-contain",
            isCollapsed ? "h-14 max-w-[4.5rem]" : "h-[4.5rem]",
          )}
        />
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(pathname, item.url);
          const badgeCount = navBadges[item.url] ?? 0;
          const pendingCount = navPendingBadges[item.url] ?? 0;
          const Icon = item.icon;

          return (
            <Link
              key={`${item.title}-${item.url}`}
              href={item.url}
              onClick={handleNavigate}
              title={navLabel(item)}
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
                <span className="flex-1 truncate">{navLabel(item)}</span>
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

      <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-border pt-4">
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

        <Link
          href="/dashboard/settings"
          onClick={handleNavigate}
          title={role === "student" ? t("nav.settings") : "Настройки"}
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
          <Settings className="size-5 shrink-0" aria-hidden />
          {!isCollapsed ? (
            <span>{role === "student" ? t("nav.settings") : "Настройки"}</span>
          ) : null}
        </Link>

        <form action={signOut} className="w-full">
          <button
            type="submit"
            title={role === "student" ? t("nav.logout") : "Выйти"}
            className={cn(
              "flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-growvy-body hover:text-foreground",
              isCollapsed
                ? "justify-center px-0 py-2.5"
                : "gap-3 px-3 py-2.5",
            )}
          >
            <GrowvyLogoutIcon className="size-5 shrink-0" />
            {!isCollapsed ? (
              <span>{role === "student" ? t("nav.logout") : "Выйти"}</span>
            ) : null}
          </button>
        </form>
      </div>
    </>
  );
}

export function DashboardSidebar({
  role,
  user,
  isCollapsed,
  navBadges = {},
  navPendingBadges = {},
  className,
  embedded = false,
  onNavigate,
}: DashboardSidebarProps) {
  const panel = (
    <DashboardSidebarPanel
      role={role}
      user={user}
      isCollapsed={isCollapsed}
      navBadges={navBadges}
      navPendingBadges={navPendingBadges}
      onNavigate={onNavigate}
    />
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 flex-col overflow-y-auto bg-growvy-content py-6 px-4",
          className,
        )}
      >
        {panel}
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-growvy-content py-6 transition-[width,padding] duration-200 ease-in-out",
        isCollapsed ? "w-20 px-2" : "w-[260px] px-4",
        className,
      )}
    >
      <div className="flex h-full min-h-0 flex-col">{panel}</div>
    </aside>
  );
}
