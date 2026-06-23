import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
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
  "text-muted-foreground text-sm font-medium transition-colors hover:text-primary";

export async function LandingHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
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
            href="tel:+375447477722"
            className="whitespace-nowrap text-foreground transition-colors hover:text-primary"
          >
            +375 44 74-777-22
          </a>
          <a
            href="tel:+375298187722"
            className="whitespace-nowrap text-foreground transition-colors hover:text-primary"
          >
            +375 29 818-77-22
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ModeToggle />
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
