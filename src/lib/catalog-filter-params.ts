import type { Database } from "@/types/database.types";
import {
  AGE_GROUP_LABELS,
  COURSE_LANGUAGE_LABELS,
  DELIVERY_FORMAT_LABELS,
} from "@/lib/validations/course-settings-schema";

const AUDIENCE_URL = ["Дети", "Взрослые"] as const;

type CourseLevel = Database["public"]["Enums"]["course_level"];

const COURSE_LEVELS = [
  "0",
  "A1",
  "A2",
  "B1",
  "B1+",
  "B2",
  "B2+",
  "C1",
  "C2",
] as const satisfies readonly CourseLevel[];

function firstString(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export type CatalogFiltersApplied = {
  audience: (typeof AUDIENCE_URL)[number] | null;
  format: (typeof DELIVERY_FORMAT_LABELS)[number] | null;
  language: (typeof COURSE_LANGUAGE_LABELS)[number] | null;
  age: (typeof AGE_GROUP_LABELS)[number] | null;
  level: CourseLevel | null;
};

export function parseCatalogFilters(
  sp: Record<string, string | string[] | undefined>,
): CatalogFiltersApplied {
  const rawAudience = firstString(sp, "audience");
  const audience =
    rawAudience && (AUDIENCE_URL as readonly string[]).includes(rawAudience)
      ? (rawAudience as (typeof AUDIENCE_URL)[number])
      : null;

  const rawFormat = firstString(sp, "format");
  const format =
    rawFormat &&
    (DELIVERY_FORMAT_LABELS as readonly string[]).includes(rawFormat)
      ? (rawFormat as (typeof DELIVERY_FORMAT_LABELS)[number])
      : null;

  const rawLang = firstString(sp, "language");
  const language =
    rawLang && (COURSE_LANGUAGE_LABELS as readonly string[]).includes(rawLang)
      ? (rawLang as (typeof COURSE_LANGUAGE_LABELS)[number])
      : null;

  const rawAge = firstString(sp, "age");
  const age =
    rawAge && (AGE_GROUP_LABELS as readonly string[]).includes(rawAge)
      ? (rawAge as (typeof AGE_GROUP_LABELS)[number])
      : null;

  const rawLevel = firstString(sp, "level");
  const level =
    rawLevel && (COURSE_LEVELS as readonly string[]).includes(rawLevel)
      ? (rawLevel as CourseLevel)
      : null;

  return { audience, format, language, age, level };
}

export function catalogHasActiveFilters(f: CatalogFiltersApplied): boolean {
  return (
    f.audience != null ||
    f.format != null ||
    f.language != null ||
    f.age != null ||
    f.level != null
  );
}
