"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyAccess } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

export type TaxonomyGroupRow =
  Database["public"]["Tables"]["taxonomy_groups"]["Row"];
export type TaxonomyRow = Database["public"]["Tables"]["taxonomies"]["Row"];

export type TaxonomyWithGroup = TaxonomyRow & {
  group_slug: string;
  group_name: string;
};

export type TaxonomyMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export type TaxonomyListResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const taxonomyGroupInputSchema = z.object({
  name: z.string().trim().min(1, "Укажите название группы"),
  slug: z
    .string()
    .trim()
    .min(1, "Укажите slug")
    .max(64, "Слишком длинный slug")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug: латиница, цифры и дефис (например, department)",
    ),
});

const taxonomyInputSchema = z.object({
  group_id: z.string().uuid("Выберите группу таксономий"),
  label: z.string().trim().min(1, "Укажите подпись"),
  value: z
    .string()
    .trim()
    .min(1, "Укажите значение")
    .max(64, "Слишком длинное значение")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Значение: латиница, цифры и дефис (например, b1-plus)",
    ),
  sort_order: z.coerce.number().int().min(0).max(999).optional(),
  is_active: z.boolean().optional(),
});

type TaxonomyJoinRow = TaxonomyRow & {
  taxonomy_groups: { slug: string; name: string } | null;
};

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Проверьте введённые данные.";
}

function mapTaxonomyRow(row: TaxonomyJoinRow): TaxonomyWithGroup {
  return {
    ...row,
    group_slug: row.taxonomy_groups?.slug ?? "",
    group_name: row.taxonomy_groups?.name ?? "",
  };
}

function revalidateTaxonomyPaths() {
  revalidatePath("/dashboard/admin/taxonomies");
  revalidatePath("/");
}

async function getAdminWriter() {
  await verifyAccess(["admin"]);
  const admin = createAdminClient();
  if (!admin) {
    console.error("[taxonomy-actions] admin client is not configured");
  }
  return admin;
}

export async function getTaxonomyGroups(): Promise<
  TaxonomyListResult<TaxonomyGroupRow[]>
> {
  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось загрузить категории." };
  }

  try {
    const { data, error } = await admin
      .from("taxonomy_groups")
      .select("*")
      .order("slug", { ascending: true });

    if (error) {
      console.error("[getTaxonomyGroups]", error.message);
      return { ok: false, error: "Не удалось загрузить категории." };
    }

    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[getTaxonomyGroups]", err);
    return { ok: false, error: "Не удалось загрузить категории." };
  }
}

export async function createTaxonomyGroup(
  input: z.input<typeof taxonomyGroupInputSchema>,
): Promise<TaxonomyMutationResult> {
  const parsed = taxonomyGroupInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось создать категорию." };
  }

  try {
    const { error } = await admin.from("taxonomy_groups").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
    });

    if (error) {
      console.error("[createTaxonomyGroup]", error.message);
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "Группа с таким slug уже существует"
            : "Не удалось создать категорию.",
      };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[createTaxonomyGroup]", err);
    return { ok: false, error: "Не удалось создать категорию." };
  }
}

export async function getTaxonomies(): Promise<
  TaxonomyListResult<TaxonomyWithGroup[]>
> {
  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось загрузить фильтры." };
  }

  try {
    const { data, error } = await admin
      .from("taxonomies")
      .select("*, taxonomy_groups!inner(slug, name)")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("[getTaxonomies]", error.message);
      return { ok: false, error: "Не удалось загрузить фильтры." };
    }

    const rows = (data ?? []) as TaxonomyJoinRow[];
    rows.sort((a, b) => {
      const slugCmp = (a.taxonomy_groups?.slug ?? "").localeCompare(
        b.taxonomy_groups?.slug ?? "",
      );
      if (slugCmp !== 0) return slugCmp;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.label.localeCompare(b.label);
    });

    return { ok: true, data: rows.map(mapTaxonomyRow) };
  } catch (err) {
    console.error("[getTaxonomies]", err);
    return { ok: false, error: "Не удалось загрузить фильтры." };
  }
}

export async function createTaxonomy(
  input: z.input<typeof taxonomyInputSchema>,
): Promise<TaxonomyMutationResult> {
  const parsed = taxonomyInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось создать значение." };
  }

  try {
    const { error } = await admin.from("taxonomies").insert({
      group_id: parsed.data.group_id,
      label: parsed.data.label,
      value: parsed.data.value,
      sort_order: parsed.data.sort_order ?? 0,
      is_active: parsed.data.is_active ?? true,
    });

    if (error) {
      console.error("[createTaxonomy]", error.message);
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "Такое значение уже есть в этой категории"
            : "Не удалось создать значение.",
      };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[createTaxonomy]", err);
    return { ok: false, error: "Не удалось создать значение." };
  }
}

export async function updateTaxonomy(
  id: string,
  input: z.input<typeof taxonomyInputSchema>,
): Promise<TaxonomyMutationResult> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Некорректный идентификатор" };
  }

  const parsed = taxonomyInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось сохранить значение." };
  }

  try {
    const { error } = await admin
      .from("taxonomies")
      .update({
        group_id: parsed.data.group_id,
        label: parsed.data.label,
        value: parsed.data.value,
        sort_order: parsed.data.sort_order ?? 0,
        ...(parsed.data.is_active === undefined
          ? {}
          : { is_active: parsed.data.is_active }),
      })
      .eq("id", idParsed.data);

    if (error) {
      console.error("[updateTaxonomy]", error.message);
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "Такое значение уже есть в этой категории"
            : "Не удалось сохранить значение.",
      };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[updateTaxonomy]", err);
    return { ok: false, error: "Не удалось сохранить значение." };
  }
}

export async function toggleTaxonomyActive(
  id: string,
  currentStatus: boolean,
): Promise<TaxonomyMutationResult> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Некорректный идентификатор" };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось обновить статус." };
  }

  try {
    const { error } = await admin
      .from("taxonomies")
      .update({ is_active: !currentStatus })
      .eq("id", idParsed.data);

    if (error) {
      console.error("[toggleTaxonomyActive]", error.message);
      return { ok: false, error: "Не удалось обновить статус." };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[toggleTaxonomyActive]", err);
    return { ok: false, error: "Не удалось обновить статус." };
  }
}

export async function deleteTaxonomy(
  id: string,
): Promise<TaxonomyMutationResult> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Некорректный идентификатор" };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось удалить значение." };
  }

  try {
    const { error } = await admin
      .from("taxonomies")
      .delete()
      .eq("id", idParsed.data);

    if (error) {
      console.error("[deleteTaxonomy]", error.message);
      return { ok: false, error: "Не удалось удалить значение." };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteTaxonomy]", err);
    return { ok: false, error: "Не удалось удалить значение." };
  }
}

export async function deleteTaxonomyGroup(
  groupId: string,
): Promise<TaxonomyMutationResult> {
  const idParsed = z.string().uuid().safeParse(groupId);
  if (!idParsed.success) {
    return { ok: false, error: "Некорректный идентификатор" };
  }

  const admin = await getAdminWriter();
  if (!admin) {
    return { ok: false, error: "Не удалось удалить категорию." };
  }

  try {
    const { error } = await admin
      .from("taxonomy_groups")
      .delete()
      .eq("id", idParsed.data);

    if (error) {
      console.error("[deleteTaxonomyGroup]", error.message);
      return { ok: false, error: "Не удалось удалить категорию." };
    }

    revalidateTaxonomyPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteTaxonomyGroup]", err);
    return { ok: false, error: "Не удалось удалить категорию." };
  }
}
