"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/dict";

type LanguageSwitcherProps = {
  className?: string;
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t, isStudent } = useLanguage();

  if (!isStudent) {
    return null;
  }

  function select(next: Locale) {
    if (locale !== next) {
      setLocale(next);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-xl border border-border bg-growvy-body p-0.5",
        className,
      )}
      role="group"
      aria-label={t("a11y.switchLanguage")}
    >
      <Button
        type="button"
        variant={locale === "ru" ? "default" : "ghost"}
        size="sm"
        className="h-8 min-w-10 rounded-lg px-2 text-xs font-semibold"
        aria-pressed={locale === "ru"}
        onClick={() => select("ru")}
      >
        RU
      </Button>
      <Button
        type="button"
        variant={locale === "en" ? "default" : "ghost"}
        size="sm"
        className="h-8 min-w-10 rounded-lg px-2 text-xs font-semibold"
        aria-pressed={locale === "en"}
        onClick={() => select("en")}
      >
        EN
      </Button>
    </div>
  );
}
