/** Slug групп таксономий (совпадают с прежним taxonomies.type). */
export const TAXONOMY_GROUP_SLUG = {
  format: "format",
  language: "language",
  audience: "audience",
  ageGroup: "age_group",
  cefrLevel: "cefr_level",
} as const;

export type CourseTaxonomySelections = {
  marketing_audience: string | null;
  delivery_format: string | null;
  language: string | null;
  age_group: string | null;
  level: string | null;
};

type CourseTaxonomyJoinRow = {
  taxonomy_id: string;
  taxonomies: {
    id: string;
    label?: string;
    value?: string;
    taxonomy_groups: { slug: string } | null;
  } | null;
};

export function selectionsFromCourseTaxonomies(
  rows: CourseTaxonomyJoinRow[],
): CourseTaxonomySelections {
  const result: CourseTaxonomySelections = {
    marketing_audience: null,
    delivery_format: null,
    language: null,
    age_group: null,
    level: null,
  };

  for (const row of rows) {
    const slug = row.taxonomies?.taxonomy_groups?.slug;
    const id = row.taxonomy_id;
    if (!slug) continue;

    switch (slug) {
      case TAXONOMY_GROUP_SLUG.format:
        result.delivery_format = id;
        break;
      case TAXONOMY_GROUP_SLUG.language:
        result.language = id;
        break;
      case TAXONOMY_GROUP_SLUG.audience:
        result.marketing_audience = id;
        break;
      case TAXONOMY_GROUP_SLUG.ageGroup:
        result.age_group = id;
        break;
      case TAXONOMY_GROUP_SLUG.cefrLevel:
        result.level = id;
        break;
      default:
        break;
    }
  }

  return result;
}

export type ResolvedCourseTaxonomyLabels = {
  audience: string | null;
  format: string | null;
  language: string | null;
  ageGroup: string | null;
  level: string | null;
};

export function labelsFromCourseTaxonomies(
  rows: CourseTaxonomyJoinRow[],
): ResolvedCourseTaxonomyLabels {
  const result: ResolvedCourseTaxonomyLabels = {
    audience: null,
    format: null,
    language: null,
    ageGroup: null,
    level: null,
  };

  for (const row of rows) {
    const slug = row.taxonomies?.taxonomy_groups?.slug;
    const label = row.taxonomies?.label?.trim();
    if (!slug || !label) continue;

    switch (slug) {
      case TAXONOMY_GROUP_SLUG.audience:
        result.audience = label;
        break;
      case TAXONOMY_GROUP_SLUG.format:
        result.format = label;
        break;
      case TAXONOMY_GROUP_SLUG.language:
        result.language = label;
        break;
      case TAXONOMY_GROUP_SLUG.ageGroup:
        result.ageGroup = label;
        break;
      case TAXONOMY_GROUP_SLUG.cefrLevel:
        result.level = label;
        break;
      default:
        break;
    }
  }

  return result;
}

export function collectCourseTaxonomyIds(
  selections: CourseTaxonomySelections,
): string[] {
  return [
    selections.delivery_format,
    selections.language,
    selections.marketing_audience,
    selections.age_group,
    selections.level,
  ].filter((id): id is string => typeof id === "string" && id.length > 0);
}
