import type { LucideIcon } from "lucide-react";
import {
  BarChartIcon,
  BookOpenIcon,
  DollarSignIcon,
  FilePlusIcon,
  FileQuestionMarkIcon,
  GraduationCapIcon,
  LifeBuoyIcon,
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
      {
        title: "Тесты",
        url: "/dashboard/tests",
        icon: FileQuestionMarkIcon,
      },
      { title: "Финансы", url: "/dashboard", icon: DollarSignIcon },
      { title: "Все курсы", url: "/dashboard", icon: BookOpenIcon },
    ];
  }
  if (role === "teacher") {
    return [
      { title: "Мои курсы", url: "/dashboard/courses", icon: BookOpenIcon },
      { title: "Группы", url: "/dashboard/cohorts", icon: UsersIcon },
      {
        title: "Тесты",
        url: "/dashboard/tests",
        icon: FileQuestionMarkIcon,
      },
      {
        title: "Создать урок",
        url: "/dashboard/tests/create",
        icon: FilePlusIcon,
      },
      {
        title: "Аналитика учеников",
        url: "/dashboard",
        icon: BarChartIcon,
      },
    ];
  }
  return [
    {
      title: "Моё обучение",
      url: "/dashboard/student",
      icon: GraduationCapIcon,
    },
    { title: "Каталог", url: "/", icon: BookOpenIcon },
    { title: "Поддержка", url: "/", icon: LifeBuoyIcon },
  ];
}
