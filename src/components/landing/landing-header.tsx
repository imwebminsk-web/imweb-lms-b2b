"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-primary shrink-0 text-lg font-bold tracking-tight"
        >
          New Education
        </Link>

        <NavigationMenu className="hidden max-w-none flex-1 justify-center md:flex">
          <NavigationMenuList className="gap-0">
            <NavigationMenuItem>
              <NavigationMenuLink
                className="text-muted-foreground hover:text-foreground"
                href="#course-catalog"
              >
                Курсы
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className="text-muted-foreground hover:text-foreground"
                href="#teachers"
              >
                Преподаватели
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className="text-muted-foreground hover:text-foreground"
                href="#faq"
              >
                FAQ
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden shrink-0 flex-col items-end gap-0.5 text-right text-xs font-medium lg:flex">
          <a
            href="tel:+375447477722"
            className="text-foreground hover:text-primary whitespace-nowrap"
          >
            +375 44 74-777-22
          </a>
          <a
            href="tel:+375298187722"
            className="text-foreground hover:text-primary whitespace-nowrap"
          >
            +375 29 818-77-22
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Войти
          </Link>
          <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
            Регистрация
          </Link>
        </div>
      </div>
    </header>
  );
}
