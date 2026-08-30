import type { VariantProps } from "class-variance-authority";

import { badgeVariants } from "@/components/ui/badge";

export type CohortStatusKey =
  | "archived_course"
  | "archived_cohort"
  | "closed"
  | "active";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export type CohortStatusConfig = {
  label: string;
  description: string;
  variant: BadgeVariant;
  className?: string;
};

export function resolveCohortStatus(
  cohortIsArchived: boolean,
  courseIsArchived: boolean,
  cohortIsActive: boolean,
): CohortStatusKey {
  if (courseIsArchived) {
    return "archived_course";
  }
  if (cohortIsArchived) {
    return "archived_cohort";
  }
  if (!cohortIsActive) {
    return "closed";
  }
  return "active";
}

export const COHORT_STATUS_DICT: Record<CohortStatusKey, CohortStatusConfig> = {
  archived_course: {
    label: "В архиве (Курс)",
    description: "Курс в архиве. Доступ к материалам заморожен.",
    variant: "outline",
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-50",
  },
  archived_cohort: {
    label: "В архиве (Группа)",
    description: "Обучение завершено. Уроки и PIN закрыты.",
    variant: "outline",
    className: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50",
  },
  closed: {
    label: "Набор закрыт",
    description: "Уроки доступны. Вход по PIN закрыт.",
    variant: "outline",
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
  },
  active: {
    label: "Активна",
    description: "Уроки доступны. Вход по PIN открыт.",
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
};

/** Порядок пунктов в легенде «Обозначения». */
export const COHORT_STATUS_LEGEND_ORDER: CohortStatusKey[] = [
  "active",
  "closed",
  "archived_cohort",
  "archived_course",
];
