"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import type { SidebarNavItem } from "@/lib/dashboard/sidebar-nav"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  navBadges = {},
  navPendingBadges = {},
}: {
  items: SidebarNavItem[]
  navBadges?: Record<string, number>
  navPendingBadges?: Record<string, number>
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const badgeCount = navBadges[item.url] ?? 0
            const pendingCount = navPendingBadges[item.url] ?? 0
            return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={
                  pathname === item.url || pathname.startsWith(`${item.url}/`)
                }
                asChild
              >
                <Link href={item.url} className="flex w-full items-center gap-2">
                  <item.icon />
                  <span className="flex-1 truncate">{item.title}</span>
                  {pendingCount > 0 || badgeCount > 0 ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {pendingCount > 0 ? (
                        <Badge
                          className="min-w-5 justify-center border-transparent bg-yellow-500 px-1.5 tabular-nums text-black hover:bg-yellow-600"
                        >
                          {pendingCount}
                        </Badge>
                      ) : null}
                      {badgeCount > 0 ? (
                        <Badge
                          variant="destructive"
                          className="min-w-5 shrink-0 justify-center px-1.5 tabular-nums"
                        >
                          {badgeCount}
                        </Badge>
                      ) : null}
                    </span>
                  ) : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
