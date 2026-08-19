import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getTaxonomies, getTaxonomyGroups } from "@/app/actions/taxonomy-actions";
import { TaxonomiesAdminClient } from "@/components/admin/taxonomies/taxonomies-admin-client";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Справочники",
  description: "Управление таксономиями для фильтров каталога",
};

export default async function AdminTaxonomiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/");
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Администратор";

  const [taxonomiesResult, groupsResult] = await Promise.all([
    getTaxonomies(),
    getTaxonomyGroups(),
  ]);

  if (!taxonomiesResult.success) {
    throw new Error(taxonomiesResult.error);
  }

  if (!groupsResult.success) {
    throw new Error(groupsResult.error);
  }

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Справочники</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Настройка фильтров и тегов для каталога курсов.
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
