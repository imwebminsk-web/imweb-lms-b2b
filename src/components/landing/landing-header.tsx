import Link from "next/link";

import { LandingHeaderActions } from "@/components/landing/landing-header-actions";
import { Logo } from "@/components/ui/logo";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { createClient } from "@/lib/supabase/server";

const navLinkClassName =
  "text-[#001352] dark:text-white text-base font-medium transition-colors hover:text-[#001352]/80 dark:hover:text-white/80";

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.11 4.93A9.81 9.81 0 0 0 12.03 2C6.57 2 2.12 6.45 2.12 11.91c0 1.75.46 3.46 1.33 4.97L2 22l5.27-1.38a9.82 9.82 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.84-6.99ZM12.04 20.2h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.25-4.36c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.4 5.83c0 4.54-3.69 8.23-8.24 8.23Zm4.51-6.15c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.65-1.24-1.46-1.39-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.15.16 1.59.1.49-.07 1.47-.6 1.67-1.17.21-.57.21-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function ViberIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c4.96 0 9 3.42 9 7.63 0 2.43-1.37 4.6-3.5 5.99V20a1 1 0 0 1-1.58.82l-2.61-1.9c-.43.06-.87.08-1.31.08-4.96 0-9-3.42-9-7.63S7.04 2 12 2Zm-3.7 4.5c-.2 0-.4.08-.54.23-.56.58-.86 1.31-.86 2.08 0 1.89 1.23 3.68 2.47 4.75 1.25 1.08 2.72 1.91 4.53 1.91.79 0 1.54-.26 2.11-.77.14-.13.23-.32.23-.52 0-.29-.17-.55-.44-.66l-1.63-.67a.7.7 0 0 0-.84.25l-.42.56a.53.53 0 0 1-.56.2c-1.13-.34-2.29-1.45-2.75-2.55a.53.53 0 0 1 .14-.59l.5-.47a.7.7 0 0 0 .18-.75l-.66-1.68a.7.7 0 0 0-.66-.45Zm3.13-.26c-.24-.04-.46.12-.5.36-.04.24.12.46.36.5 1.84.3 3.3 1.76 3.6 3.6.04.22.23.37.43.37h.07a.43.43 0 0 0 .36-.5 5.34 5.34 0 0 0-4.32-4.33Zm.32 1.72a.43.43 0 1 0-.14.85c1.03.17 1.85.99 2.02 2.02.03.21.22.37.43.37h.07a.43.43 0 0 0 .36-.5 3.84 3.84 0 0 0-3.1-3.1Z" />
    </svg>
  );
}

function TelegramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 3.5c-.2-.16-.47-.21-.72-.13L2.7 10.3c-.35.13-.58.46-.57.84.02.38.28.69.64.79l4.8 1.49 1.87 5.75c.1.32.39.55.73.59h.09c.31 0 .6-.16.76-.43l2.66-4.27 4.42 3.25c.14.1.31.16.48.16.11 0 .22-.02.32-.06.28-.11.48-.36.54-.65l3.02-13.42c.07-.31-.04-.63-.28-.84Zm-2.58 2.26-2.45 10.91-3.93-2.89a.84.84 0 0 0-1.24.27l-2.05 3.3-1.34-4.12 7.67-6.68a.84.84 0 0 0-1.11-1.26l-8.74 7.61-2.6-.81 15.79-6.33Z" />
    </svg>
  );
}

type LandingHeaderProps = {
  platformName: string;
};

export async function LandingHeader({ platformName }: LandingHeaderProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Logo priority className="h-[4.5rem]" />
          {platformName ? (
            <span className="hidden text-lg font-semibold text-[#001352] dark:text-white sm:inline">
              {platformName}
            </span>
          ) : null}
        </Link>

        <NavigationMenu className="hidden max-w-none flex-1 justify-center lg:flex">
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
              <NavigationMenuLink className={navLinkClassName} href="#reviews">
                Отзывы
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navLinkClassName} href="#faq">
                FAQ
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navLinkClassName} href="/platform">
                О платформе
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden shrink-0 flex-col items-end gap-0.5 text-right text-xs font-medium sm:flex">
          <a
            href="tel:+375291187722"
            className="whitespace-nowrap text-[#001352] text-sm font-semibold transition-colors hover:text-[#001352]/80 dark:text-white dark:hover:text-white/80"
          >
            +375 29 118-77-22
          </a>

          <div className="mt-1 flex flex-row items-center justify-end gap-3">
            <a
              href="https://wa.me/375291187722"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="text-[#2cb742] transition-opacity hover:opacity-80"
            >
              <WhatsAppIcon className="h-6 w-6" />
            </a>
            <a
              href="viber://chat?number=%2B375291187722"
              aria-label="Viber"
              className="text-[#7360F2] transition-opacity hover:opacity-80"
            >
              <ViberIcon className="h-6 w-6" />
            </a>
            <a
              href="https://t.me/+375291187722"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="text-[#26A5E4] transition-opacity hover:opacity-80"
            >
              <TelegramIcon className="h-6 w-6" />
            </a>
          </div>
        </div>

        <LandingHeaderActions isAuthed={isAuthed} />
      </div>
    </header>
  );
}
