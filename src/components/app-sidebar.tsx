"use client"

import * as React from "react"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Logo } from "@/components/ui/logo"
import {
  getSidebarNavForRole,
  type ProfileRole,
} from "@/lib/dashboard/sidebar-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type AppSidebarUser = {
  name: string
  email: string
  avatar: string
}

export function AppSidebar({
  user,
  role,
  navBadges = {},
  navPendingBadges = {},
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AppSidebarUser
  role: ProfileRole
  navBadges?: Record<string, number>
  navPendingBadges?: Record<string, number>
}) {
  const navMain = getSidebarNavForRole(role)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              asChild
            >
              <Link href="/dashboard" className="flex items-center">
                <Logo className="h-10" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          navBadges={navBadges}
          navPendingBadges={navPendingBadges}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
