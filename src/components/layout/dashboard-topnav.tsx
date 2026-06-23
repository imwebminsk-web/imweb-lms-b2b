"use client";

import { Menu } from "lucide-react";

import { FontSizeToggler } from "@/components/FontSizeToggler";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { GrowvyMenuIcon } from "@/components/layout/growvy-icons";
import { ModeToggle } from "@/components/mode-toggle";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import type { ProfileRole } from "@/lib/dashboard/sidebar-nav";
import { cn } from "@/lib/utils";

type DashboardTopnavProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
  role: ProfileRole;
  className?: string;
};

export function DashboardTopnav({
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileNav,
  role,
  className,
}: DashboardTopnavProps) {
  const { t } = useLanguage();

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-3 border-b border-border bg-growvy-content px-4 sm:px-6",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-xl text-foreground hover:bg-growvy-body lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Открыть меню навигации"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden size-10 shrink-0 rounded-xl text-foreground hover:bg-growvy-body lg:inline-flex"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? "Свернуть боковую панель" : "Развернуть боковую панель"}
        aria-expanded={isSidebarOpen}
      >
        <GrowvyMenuIcon className="size-5" />
      </Button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {role === "student" ? <LanguageSwitcher /> : null}

        <FontSizeToggler
          decreaseLabel={t("a11y.decreaseFont")}
          increaseLabel={t("a11y.increaseFont")}
        />

        <ModeToggle ariaLabel={t("a11y.toggleTheme")} />
      </div>
    </header>
  );
}
