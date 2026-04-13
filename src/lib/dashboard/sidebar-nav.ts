import type { LucideIcon } from "lucide-react";
import {
  BarChartIcon,
  BookOpenIcon,
  DollarSignIcon,
  FilePlusIcon,
  GraduationCapIcon,
  LifeBuoyIcon,
  Settings2Icon,
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
      { title: "Management", url: "/admin", icon: Settings2Icon },
      { title: "Finances", url: "/admin/dashboard", icon: DollarSignIcon },
      { title: "All Courses", url: "/admin/dashboard", icon: BookOpenIcon },
    ];
  }
  if (role === "teacher") {
    return [
      { title: "My Courses", url: "/teacher/dashboard", icon: BookOpenIcon },
      { title: "Create Lesson", url: "/admin/create", icon: FilePlusIcon },
      {
        title: "Student Analytics",
        url: "/admin/dashboard",
        icon: BarChartIcon,
      },
    ];
  }
  return [
    {
      title: "My Learning",
      url: "/dashboard",
      icon: GraduationCapIcon,
    },
    { title: "Catalog", url: "/", icon: BookOpenIcon },
    { title: "Support", url: "/", icon: LifeBuoyIcon },
  ];
}
