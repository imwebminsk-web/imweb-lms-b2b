import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  BookOpenIcon,
  Building,
  CheckSquare,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LifeBuoyIcon,
  Settings,
  Users,
  UsersIcon,
} from "lucide-react";

import { isCorporateMode, isSchoolMode } from "@/lib/config/app-mode";
import type { Database } from "@/types/database.types";

export type ProfileRole = Database["public"]["Enums"]["profile_role"];

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export function getSidebarNavForRole(role: ProfileRole): SidebarNavItem[] {
  let nav: SidebarNavItem[] = [];

  if (role === "admin") {
    nav = [
      { title: "Главная", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Пользователи", url: "/dashboard/admin/users", icon: Users },
      {
        title: "Фильтры каталога",
        url: "/dashboard/admin/taxonomies",
        icon: LibraryIcon,
      },
      {
        title: "Оргструктура",
        url: "/dashboard/admin/structure",
        icon: Building,
      },
      {
        title: "Аналитика",
        url: "/dashboard/analytics",
        icon: BarChart3Icon,
      },
      {
        title: "Настройки платформы",
        url: "/dashboard/admin/settings",
        icon: Settings,
      },
    ];
  } else if (role === "head_teacher") {
    nav = [
      { title: "Главная", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Курсы", url: "/dashboard/courses", icon: BookOpenIcon },
      { title: "Группы", url: "/dashboard/cohorts", icon: UsersIcon },
      { title: "Ученики", url: "/dashboard/students", icon: Users },
      {
        title: "Аналитика",
        url: "/dashboard/analytics",
        icon: BarChart3Icon,
      },
      { title: "Тесты", url: "/dashboard/tests", icon: CheckSquare },
      { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
    ];
  } else if (role === "teacher") {
    nav = [
      { title: "Мои курсы", url: "/dashboard/courses", icon: BookOpenIcon },
      { title: "Группы", url: "/dashboard/cohorts", icon: UsersIcon },
      { title: "Ученики", url: "/dashboard/students", icon: Users },
      { title: "Тесты", url: "/dashboard/tests", icon: CheckSquare },
      { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
    ];
  } else {
    nav = [
      {
        title: "Моё обучение",
        url: "/dashboard",
        icon: GraduationCapIcon,
      },
      { title: "Каталог", url: "/", icon: BookOpenIcon },
      { title: "Поддержка", url: "/dashboard/support", icon: LifeBuoyIcon },
    ];
  }

  return nav.filter((item) => {
    if (item.url === "/dashboard/cohorts") return isSchoolMode;
    if (item.url === "/dashboard/admin/structure") return isCorporateMode;
    if (item.url === "/dashboard/analytics") return isCorporateMode;
    return true;
  });
}
