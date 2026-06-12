import type { Database } from "@/types/database.types";

export type CatalogTaxonomy = Pick<
  Database["public"]["Tables"]["taxonomies"]["Row"],
  "id" | "type" | "label" | "value" | "sort_order"
>;

export type CatalogTaxonomyType =
  | "format"
  | "language"
  | "audience"
  | "age_group"
  | "cefr_level";

export type CatalogTaxonomiesByType = Record<
  CatalogTaxonomyType,
  CatalogTaxonomy[]
>;

const TAXONOMY_TYPES: CatalogTaxonomyType[] = [
  "format",
  "language",
  "audience",
  "age_group",
  "cefr_level",
];

export function groupCatalogTaxonomies(
  rows: CatalogTaxonomy[],
): CatalogTaxonomiesByType {
  const grouped = Object.fromEntries(
    TAXONOMY_TYPES.map((type) => [type, [] as CatalogTaxonomy[]]),
  ) as CatalogTaxonomiesByType;

  for (const row of rows) {
    const type = row.type as CatalogTaxonomyType;
    if (TAXONOMY_TYPES.includes(type)) {
      grouped[type].push(row);
    }
  }

  for (const type of TAXONOMY_TYPES) {
    grouped[type].sort((a, b) => a.sort_order - b.sort_order);
  }

  return grouped;
}

export function findCatalogTaxonomy(
  rows: CatalogTaxonomy[],
  type: CatalogTaxonomyType,
  value: string | null | undefined,
): CatalogTaxonomy | undefined {
  if (!value) return undefined;
  return rows.find((row) => row.type === type && row.value === value);
}

export function taxonomyLabelForValue(
  rows: CatalogTaxonomy[],
  type: CatalogTaxonomyType,
  value: string | null,
): string | null {
  return findCatalogTaxonomy(rows, type, value)?.label ?? null;
}
