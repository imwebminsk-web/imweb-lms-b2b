import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CheckSquare,
  DollarSignIcon,
  FileQuestionMarkIcon,
  GraduationCapIcon,
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
      {
        title: "Тесты",
        url: "/dashboard/tests",
        icon: FileQuestionMarkIcon,
      },
      {
        title: "Справочники",
        url: "/dashboard/admin/taxonomies",
        icon: LibraryIcon,
      },
      { title: "Финансы", url: "/dashboard", icon: DollarSignIcon },
      { title: "Все курсы", url: "/dashboard", icon: BookOpenIcon },
    ];
  }
  if (role === "teacher") {
    return [
      { title: "Мои курсы", url: "/dashboard/courses", icon: BookOpenIcon },
      { title: "Группы", url: "/dashboard/cohorts", icon: UsersIcon },
      { title: "Ученики", url: "/dashboard/students", icon: Users },
      { title: "Тесты", url: "/dashboard/tests", icon: CheckSquare },
    ];
  }
  return [
    {
      title: "Моё обучение",
      url: "/dashboard",
      icon: GraduationCapIcon,
    },
    { title: "Каталог", url: "/", icon: BookOpenIcon },
    { title: "Поддержка", url: "/", icon: LifeBuoyIcon },
  ];
}
