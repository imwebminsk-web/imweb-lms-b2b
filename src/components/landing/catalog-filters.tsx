"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AGE_GROUP_LABELS,
  COURSE_LANGUAGE_LABELS,
  DELIVERY_FORMAT_LABELS,
} from "@/lib/validations/course-settings-schema";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

const AUDIENCE_OPTIONS = ["Дети", "Взрослые"] as const;

const CEFR_LEVELS: Database["public"]["Enums"]["course_level"][] = [
  "0",
  "A1",
  "A2",
  "B1",
  "B1+",
  "B2",
  "B2+",
  "C1",
  "C2",
];

function buildNextHref(
  pathname: string,
  current: URLSearchParams,
  updates: Record<string, string | null>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function FilterPill({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground shadow"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}
    >
      {label}
    </button>
  );
}

function PillRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export function CatalogFiltersFallback() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex animate-pulse flex-col gap-2">
          <div className="bg-muted h-3 w-16 rounded-full" />
          <div className="flex flex-wrap gap-2">
            <div className="bg-muted h-9 w-24 rounded-full" />
            <div className="bg-muted h-9 w-28 rounded-full" />
            <div className="bg-muted h-9 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const href = buildNextHref(pathname, searchParams, updates);
      router.push(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const audience = searchParams.get("audience") ?? "";
  const format = searchParams.get("format") ?? "";
  const language = searchParams.get("language") ?? "";
  const age = searchParams.get("age") ?? "";
  const level = searchParams.get("level") ?? "";

  const audienceSelect = useMemo(() => {
    if (AUDIENCE_OPTIONS.includes(audience as (typeof AUDIENCE_OPTIONS)[number])) {
      return audience;
    }
    return "";
  }, [audience]);

  const hasActiveFilters = Boolean(
    format || language || audienceSelect || age || level,
  );

  const toggleParam = useCallback(
    (key: string, value: string, current: string) => {
      pushParams({
        [key]: current === value ? null : value,
      });
    },
    [pushParams],
  );

  const handleAudienceClick = useCallback(
    (option: (typeof AUDIENCE_OPTIONS)[number]) => {
      if (audienceSelect === option) {
        pushParams({
          audience: null,
          age: null,
          level: null,
        });
        return;
      }

      const updates: Record<string, string | null> = {
        audience: option,
      };
      if (option !== "Дети") updates.age = null;
      if (option !== "Взрослые") updates.level = null;
      pushParams(updates);
    },
    [audienceSelect, pushParams],
  );

  return (
    <div
      role="toolbar"
      aria-label="Фильтры каталога курсов"
      className="flex w-full flex-col gap-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <PillRow label="Язык">
          {COURSE_LANGUAGE_LABELS.map((opt) => (
            <FilterPill
              key={opt}
              label={opt}
              isActive={language === opt}
              onClick={() => toggleParam("language", opt, language)}
            />
          ))}
        </PillRow>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary h-9 shrink-0 self-start sm:mt-5"
            onClick={() => router.push(pathname, { scroll: false })}
          >
            Сбросить фильтры
          </Button>
        ) : null}
      </div>

      <PillRow label="Аудитория">
        {AUDIENCE_OPTIONS.map((opt) => (
          <FilterPill
            key={opt}
            label={opt}
            isActive={audienceSelect === opt}
            onClick={() => handleAudienceClick(opt)}
          />
        ))}
      </PillRow>

      <PillRow label="Формат">
        {DELIVERY_FORMAT_LABELS.map((opt) => (
          <FilterPill
            key={opt}
            label={opt}
            isActive={format === opt}
            onClick={() => toggleParam("format", opt, format)}
          />
        ))}
      </PillRow>

      {audienceSelect === "Дети" ? (
        <PillRow label="Возраст">
          {AGE_GROUP_LABELS.map((opt) => (
            <FilterPill
              key={opt}
              label={opt}
              isActive={age === opt}
              onClick={() => toggleParam("age", opt, age)}
            />
          ))}
        </PillRow>
      ) : null}

      {audienceSelect === "Взрослые" ? (
        <PillRow label="Уровень CEFR">
          {CEFR_LEVELS.map((opt) => (
            <FilterPill
              key={opt}
              label={opt}
              isActive={level === opt}
              onClick={() => toggleParam("level", opt, level)}
            />
          ))}
        </PillRow>
      ) : null}
    </div>
  );
}
