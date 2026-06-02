"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpCircleIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
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
              <Link href="/dashboard">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">NewEdu</span>
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
