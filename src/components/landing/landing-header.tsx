import Image from "next/image";
import Link from "next/link";

import { HelpDialog } from "@/components/landing/help-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const navLinkClassName =
  "text-[#001352] dark:text-white text-sm font-medium transition-colors hover:text-[#001352]/80 dark:hover:text-white/80";

export async function LandingHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-[#16a085] px-4 py-2">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="flex flex-col items-center text-center sm:items-end sm:text-right">
            <div>
              <span className="text-lg font-bold text-[#001352] sm:text-xl">
                Скидка до{" "}
              </span>
              <span className="text-xl font-black text-red-600 sm:text-2xl">
                -40%
              </span>
            </div>
            <div className="text-xs font-medium text-[#001352] sm:text-sm">
              действует на все форматы обучения: офлайн, онлайн, гибрид.
            </div>
          </div>
          <Image
            src="/gift.png"
            alt="Подарок"
            width={56}
            height={56}
            className="ml-0 shrink-0 object-contain sm:ml-[30px]"
          />
          <div className="mt-2 flex shrink-0 flex-col items-center gap-2 xs:flex-row sm:mt-0 sm:ml-4 sm:flex-row">
            <Link
              href="/platform"
              className="h-auto whitespace-nowrap rounded-lg bg-[#e3efff] px-2 py-1 text-[11px] font-semibold text-[#001352] transition-colors hover:bg-[#d8e8ff] sm:text-xs"
            >
              О платформе
            </Link>
            <HelpDialog
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-auto rounded-xl px-2 py-1 text-[11px] font-semibold sm:text-xs",
              )}
            >
              Помогите с выбором
            </HelpDialog>
          </div>
        </div>
      </div>
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Logo priority className="h-[4.5rem]" />
        </Link>

        <NavigationMenu className="hidden max-w-none flex-1 justify-center md:flex">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuLink className={navLinkClassName} href="#course-catalog">
                Курсы
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navLinkClassName} href="#teachers">
                Преподаватели
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navLinkClassName} href="#faq">
                FAQ
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden shrink-0 flex-col items-end gap-0.5 text-right text-xs font-medium lg:flex">
          <a
            href="tel:+375291187722"
            className="whitespace-nowrap text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-white dark:hover:text-white/80"
          >
            +375 29 118-77-22
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            href={isAuthed ? "/dashboard" : "/login"}
            className={cn(buttonVariants({ size: "sm" }), "rounded-xl")}
          >
            {isAuthed ? "Личный кабинет" : "Войти"}
          </Link>
        </div>
      </div>
    </header>
  );
}
