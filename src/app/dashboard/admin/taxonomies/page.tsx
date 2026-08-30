import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getTaxonomies, getTaxonomyGroups } from "@/app/actions/taxonomy-actions";
import { TaxonomiesAdminClient } from "@/components/admin/taxonomies/taxonomies-admin-client";
import { SiteHeader } from "@/components/site-header";
import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Фильтры каталога",
  description: "Управление таксономиями для фильтров каталога",
};

export default async function AdminTaxonomiesPage() {
  const { user, profile } = await verifyAccess(["admin"]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Администратор";

  const [taxonomiesResult, groupsResult] = await Promise.all([
    getTaxonomies(),
    getTaxonomyGroups(),
  ]);

  if (!taxonomiesResult.ok) {
    throw new Error(taxonomiesResult.error);
  }

  if (!groupsResult.ok) {
    throw new Error(groupsResult.error);
  }

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Фильтры каталога</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Настройка фильтров для каталога курсов.
            </p>
          </div>
        </div>
        <TaxonomiesAdminClient
          initialTaxonomies={taxonomiesResult.data}
          initialGroups={groupsResult.data}
        />
      </div>
    </>
  );
}
