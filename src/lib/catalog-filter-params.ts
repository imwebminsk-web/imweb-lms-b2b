import type { CatalogTaxonomy } from "@/lib/catalog-taxonomies";
import {
  groupCatalogTaxonomies,
  taxonomiesForGroup,
} from "@/lib/catalog-taxonomies";
import { TAXONOMY_GROUP_SLUG } from "@/lib/course-taxonomy-map";

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
  groupSlug: string,
  grouped: ReturnType<typeof groupCatalogTaxonomies>,
): string | null {
  if (!raw) return null;
  const allowed = taxonomiesForGroup(grouped, groupSlug).some(
    (row) => row.value === raw,
  );
  return allowed ? raw : null;
}

export function parseCatalogFilters(
  sp: Record<string, string | string[] | undefined>,
  taxonomies: CatalogTaxonomy[],
): CatalogFiltersApplied {
  const grouped = groupCatalogTaxonomies(taxonomies);

  const audience = parseTaxonomyValue(
    firstString(sp, "audience"),
    TAXONOMY_GROUP_SLUG.audience,
    grouped,
  );

  const format = parseTaxonomyValue(
    firstString(sp, "format"),
    TAXONOMY_GROUP_SLUG.format,
    grouped,
  );

  const language = parseTaxonomyValue(
    firstString(sp, "language"),
    TAXONOMY_GROUP_SLUG.language,
    grouped,
  );

  const rawAge = firstString(sp, "age");
  const age =
    audience === "children"
      ? parseTaxonomyValue(rawAge, TAXONOMY_GROUP_SLUG.ageGroup, grouped)
      : null;

  const rawLevel = firstString(sp, "level");
  const level =
    audience === "adults"
      ? parseTaxonomyValue(rawLevel, TAXONOMY_GROUP_SLUG.cefrLevel, grouped)
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
