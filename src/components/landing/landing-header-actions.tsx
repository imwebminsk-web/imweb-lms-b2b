"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinkClassName =
  "text-[#001352] dark:text-white text-base font-medium transition-colors hover:text-[#001352]/80 dark:hover:text-white/80";

type LandingHeaderActionsProps = {
  isAuthed: boolean;
};

export function LandingHeaderActions({ isAuthed }: LandingHeaderActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <Link
        href={isAuthed ? "/dashboard" : "/"}
        className={cn(
          buttonVariants({ size: "sm", variant: "landing" }),
          "hidden rounded-xl lg:inline-flex",
        )}
      >
        {isAuthed ? "Личный кабинет" : "Войти"}
      </Link>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5 text-[#001352] dark:text-white" />
            <span className="sr-only">Открыть меню</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-[300px] flex-col sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="text-left text-[#001352] dark:text-white">
              Меню
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            <Link href="#course-catalog" className={navLinkClassName}>
              Курсы
            </Link>
            <Link href="#teachers" className={navLinkClassName}>
              Преподаватели
            </Link>
            <Link href="#reviews" className={navLinkClassName}>
              Отзывы
            </Link>
            <Link href="#faq" className={navLinkClassName}>
              FAQ
            </Link>
            <Link href="/platform" className={navLinkClassName}>
              О платформе
            </Link>
          </div>
          <div className="mt-auto flex flex-col gap-4">
            <Link
              href={isAuthed ? "/dashboard" : "/"}
              className={cn(
                buttonVariants({ size: "lg", variant: "landing" }),
                "w-full rounded-xl",
              )}
            >
              {isAuthed ? "Личный кабинет" : "Войти"}
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
