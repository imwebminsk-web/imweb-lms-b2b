import type { CatalogTaxonomy, CatalogTaxonomyType } from "@/lib/catalog-taxonomies";
import { groupCatalogTaxonomies } from "@/lib/catalog-taxonomies";

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
  /** Slug из taxonomies.value */
  audience: string | null;
  format: string | null;
  language: string | null;
  age: string | null;
  level: string | null;
};

function parseTaxonomyValue(
  raw: string | undefined,
  type: CatalogTaxonomyType,
  grouped: ReturnType<typeof groupCatalogTaxonomies>,
): string | null {
  if (!raw) return null;
  const allowed = grouped[type].some((row) => row.value === raw);
  return allowed ? raw : null;
}

export function parseCatalogFilters(
  sp: Record<string, string | string[] | undefined>,
  taxonomies: CatalogTaxonomy[],
): CatalogFiltersApplied {
  const grouped = groupCatalogTaxonomies(taxonomies);

  const audience = parseTaxonomyValue(
    firstString(sp, "audience"),
    "audience",
    grouped,
  );

  const format = parseTaxonomyValue(
    firstString(sp, "format"),
    "format",
    grouped,
  );

  const language = parseTaxonomyValue(
    firstString(sp, "language"),
    "language",
    grouped,
  );

  const rawAge = firstString(sp, "age");
  const age =
    audience === "children"
      ? parseTaxonomyValue(rawAge, "age_group", grouped)
      : null;

  const rawLevel = firstString(sp, "level");
  const level =
    audience === "adults"
      ? parseTaxonomyValue(rawLevel, "cefr_level", grouped)
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
