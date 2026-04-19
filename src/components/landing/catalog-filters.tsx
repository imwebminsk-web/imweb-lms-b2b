"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGE_GROUP_LABELS,
  COURSE_LANGUAGE_LABELS,
  DELIVERY_FORMAT_LABELS,
} from "@/lib/validations/course-settings-schema";
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

  return (
    <aside className="border-border bg-card/40 w-full shrink-0 rounded-xl border p-4 lg:sticky lg:top-20 lg:w-64 lg:self-start">
      <h2 className="text-foreground mb-4 text-sm font-semibold tracking-tight">
        Фильтры
      </h2>
      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cf-format">Формат</Label>
          <Select
            value={format || "__all__"}
            onValueChange={(v) => {
              pushParams({
                format: v === "__all__" ? null : v,
              });
            }}
          >
            <SelectTrigger id="cf-format" className="w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
              {DELIVERY_FORMAT_LABELS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cf-language">Язык</Label>
          <Select
            value={language || "__all__"}
            onValueChange={(v) => {
              pushParams({
                language: v === "__all__" ? null : v,
              });
            }}
          >
            <SelectTrigger id="cf-language" className="w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
              {COURSE_LANGUAGE_LABELS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cf-audience">Аудитория</Label>
          <Select
            value={audienceSelect || "__all__"}
            onValueChange={(v) => {
              if (v === "__all__") {
                pushParams({
                  audience: null,
                  age: null,
                  level: null,
                });
                return;
              }
              const updates: Record<string, string | null> = {
                audience: v,
              };
              if (v !== "Дети") updates.age = null;
              if (v !== "Взрослые") updates.level = null;
              pushParams(updates);
            }}
          >
            <SelectTrigger id="cf-audience" className="w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
              {AUDIENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {audienceSelect === "Дети" ? (
          <div className="grid gap-2">
            <Label htmlFor="cf-age">Возраст</Label>
            <Select
              value={age || "__all__"}
              onValueChange={(v) => {
                pushParams({
                  age: v === "__all__" ? null : v,
                });
              }}
            >
              <SelectTrigger id="cf-age" className="w-full">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все</SelectItem>
                {AGE_GROUP_LABELS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {audienceSelect === "Взрослые" ? (
          <div className="grid gap-2">
            <Label htmlFor="cf-level">Уровень CEFR</Label>
            <Select
              value={level || "__all__"}
              onValueChange={(v) => {
                pushParams({
                  level: v === "__all__" ? null : v,
                });
              }}
            >
              <SelectTrigger id="cf-level" className="w-full">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все</SelectItem>
                {CEFR_LEVELS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-left text-xs underline-offset-2 hover:underline"
          onClick={() => router.push(pathname, { scroll: false })}
        >
          Сбросить фильтры
        </button>
      </div>
    </aside>
  );
}
