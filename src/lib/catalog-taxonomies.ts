import type { Database } from "@/types/database.types";

export type CatalogTaxonomy = Pick<
  Database["public"]["Tables"]["taxonomies"]["Row"],
  "id" | "group_id" | "label" | "value" | "sort_order"
> & {
  /** Slug группы из taxonomy_groups (format, language, …). */
  group_slug: string;
};

export type CatalogTaxonomiesByGroup = Record<string, CatalogTaxonomy[]>;

export function groupCatalogTaxonomies(
  rows: CatalogTaxonomy[],
): CatalogTaxonomiesByGroup {
  const grouped: CatalogTaxonomiesByGroup = {};

  for (const row of rows) {
    const slug = row.group_slug;
    if (!slug) continue;
    if (!grouped[slug]) {
      grouped[slug] = [];
    }
    grouped[slug].push(row);
  }

  for (const slug of Object.keys(grouped)) {
    grouped[slug].sort((a, b) => a.sort_order - b.sort_order);
  }

  return grouped;
}

export function taxonomiesForGroup(
  grouped: CatalogTaxonomiesByGroup,
  groupSlug: string,
): CatalogTaxonomy[] {
  return grouped[groupSlug] ?? [];
}

export function findCatalogTaxonomy(
  rows: CatalogTaxonomy[],
  groupSlug: string,
  value: string | null | undefined,
): CatalogTaxonomy | undefined {
  if (!value) return undefined;
  return rows.find(
    (row) => row.group_slug === groupSlug && row.value === value,
  );
}

export function taxonomyLabelForValue(
  rows: CatalogTaxonomy[],
  groupSlug: string,
  value: string | null,
): string | null {
  return findCatalogTaxonomy(rows, groupSlug, value)?.label ?? null;
}

/** Преобразует строку Supabase с join taxonomy_groups в CatalogTaxonomy. */
export function toCatalogTaxonomy(row: {
  id: string;
  group_id: string;
  label: string;
  value: string;
  sort_order: number;
  taxonomy_groups: { slug: string } | null;
}): CatalogTaxonomy | null {
  const group_slug = row.taxonomy_groups?.slug?.trim();
  if (!group_slug) return null;
  return {
    id: row.id,
    group_id: row.group_id,
    label: row.label,
    value: row.value,
    sort_order: row.sort_order,
    group_slug,
  };
}
