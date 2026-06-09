"use client";

import { GrowvyMenuIcon } from "@/components/layout/growvy-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardTopnavProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  className?: string;
};

export function DashboardTopnav({
  isSidebarOpen,
  onToggleSidebar,
  className,
}: DashboardTopnavProps) {
  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center border-b border-border bg-growvy-content px-6",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-xl text-foreground hover:bg-growvy-body"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? "Свернуть боковую панель" : "Развернуть боковую панель"}
        aria-expanded={isSidebarOpen}
      >
        <GrowvyMenuIcon className="size-5" />
      </Button>
    </header>
  );
}
