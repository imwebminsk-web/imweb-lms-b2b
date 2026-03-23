import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/site/logout-button";

export async function SiteHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  return (
    <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          NewEdu
        </Link>

        <nav className="flex items-center gap-2">
          {!isAuthed ? (
            <Link
              href="/login"
              className={buttonVariants({ size: "sm" })}
            >
              Войти
            </Link>
          ) : (
            <>
              <Link
                href="/admin"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}
              >
                Админка
              </Link>
              <LogoutButton />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

