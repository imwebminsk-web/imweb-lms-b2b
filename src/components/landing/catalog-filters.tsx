"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  groupCatalogTaxonomies,
  type CatalogTaxonomy,
} from "@/lib/catalog-taxonomies";
import { cn } from "@/lib/utils";

const AUDIENCE_CHILDREN = "children";
const AUDIENCE_ADULTS = "adults";

export type CatalogFiltersProps = {
  taxonomies: CatalogTaxonomy[];
};

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
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-transparent text-foreground hover:bg-secondary",
      )}
    >
      {label}
    </button>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  );
}

export function CatalogFiltersFallback() {
  return (
    <div className="flex w-full flex-col gap-4" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex animate-pulse flex-wrap gap-2">
          <div className="bg-muted h-9 w-24 rounded-full" />
          <div className="bg-muted h-9 w-28 rounded-full" />
          <div className="bg-muted h-9 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CatalogFilters({ taxonomies }: CatalogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const grouped = useMemo(
    () => groupCatalogTaxonomies(taxonomies),
    [taxonomies],
  );

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
    const allowed = new Set(grouped.audience.map((row) => row.value));
    return allowed.has(audience) ? audience : "";
  }, [audience, grouped.audience]);

  const toggleParam = useCallback(
    (key: string, value: string, current: string) => {
      pushParams({
        [key]: current === value ? null : value,
      });
    },
    [pushParams],
  );

  const handleAudienceClick = useCallback(
    (value: string) => {
      if (audienceSelect === value) {
        pushParams({
          audience: null,
          age: null,
          level: null,
        });
        return;
      }

      const updates: Record<string, string | null> = {
        audience: value,
      };
      if (value !== AUDIENCE_CHILDREN) updates.age = null;
      if (value !== AUDIENCE_ADULTS) updates.level = null;
      pushParams(updates);
    },
    [audienceSelect, pushParams],
  );

  return (
    <div
      role="toolbar"
      aria-label="Фильтры каталога курсов"
      className="flex w-full flex-col gap-4"
    >
      <PillRow>
        {grouped.format.map((row) => (
          <FilterPill
            key={row.id}
            label={row.label}
            isActive={format === row.value}
            onClick={() => toggleParam("format", row.value, format)}
          />
        ))}
      </PillRow>

      <PillRow>
        {grouped.language.map((row) => (
          <FilterPill
            key={row.id}
            label={row.label}
            isActive={language === row.value}
            onClick={() => toggleParam("language", row.value, language)}
          />
        ))}
      </PillRow>

      <PillRow>
        {grouped.audience.map((row) => (
          <FilterPill
            key={row.id}
            label={row.label}
            isActive={audienceSelect === row.value}
            onClick={() => handleAudienceClick(row.value)}
          />
        ))}
      </PillRow>

      {audienceSelect === AUDIENCE_CHILDREN ? (
        <PillRow>
          {grouped.age_group.map((row) => (
            <FilterPill
              key={row.id}
              label={row.label}
              isActive={age === row.value}
              onClick={() => toggleParam("age", row.value, age)}
            />
          ))}
        </PillRow>
      ) : null}

      {audienceSelect === AUDIENCE_ADULTS ? (
        <PillRow>
          {grouped.cefr_level.map((row) => (
            <FilterPill
              key={row.id}
              label={row.label}
              isActive={level === row.value}
              onClick={() => toggleParam("level", row.value, level)}
            />
          ))}
        </PillRow>
      ) : null}
    </div>
  );
}
