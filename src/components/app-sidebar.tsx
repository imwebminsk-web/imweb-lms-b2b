"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpCircleIcon,
  HelpCircleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
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
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AppSidebarUser
  role: ProfileRole
}) {
  const navMain = getSidebarNavForRole(role)

  const navSecondary = [
    { title: "Настройки", url: "/dashboard/tests", icon: SettingsIcon },
    { title: "Помощь", url: "/", icon: HelpCircleIcon },
    { title: "Поиск", url: "/", icon: SearchIcon },
  ]

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
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
