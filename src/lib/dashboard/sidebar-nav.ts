import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CheckSquare,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LifeBuoyIcon,
  Users,
  UsersIcon,
} from "lucide-react";

import type { Database } from "@/types/database.types";

export type ProfileRole = Database["public"]["Enums"]["profile_role"];

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export function getSidebarNavForRole(role: ProfileRole): SidebarNavItem[] {
  if (role === "admin") {
    return [
      { title: "Главная", url: "/dashboard", icon: LayoutDashboardIcon },
      {
        title: "Справочники",
        url: "/dashboard/admin/taxonomies",
        icon: LibraryIcon,
      },
      { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
    ];
  }
  if (role === "teacher") {
    return [
      { title: "Мои курсы", url: "/dashboard/courses", icon: BookOpenIcon },
      { title: "Группы", url: "/dashboard/cohorts", icon: UsersIcon },
      { title: "Ученики", url: "/dashboard/students", icon: Users },
      { title: "Тесты", url: "/dashboard/tests", icon: CheckSquare },
      { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
    ];
  }
  return [
    {
      title: "Моё обучение",
      url: "/dashboard",
      icon: GraduationCapIcon,
    },
    { title: "Каталог", url: "/", icon: BookOpenIcon },
    { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
  ];
}
