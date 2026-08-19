import { redirect } from "next/navigation";

import { getPlatformSettings } from "@/app/actions/settings-actions";
import { PlatformSettingsForm } from "@/components/dashboard/admin/platform-settings-form";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrHead } from "@/lib/utils/user-utils";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const hasAccess = isAdminOrHead(profile?.role);
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const settings = await getPlatformSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки платформы</h1>
        <p className="text-muted-foreground mt-2">
          Управление внешним видом и контактными данными платформы.
        </p>
      </div>

      {settings ? (
        <PlatformSettingsForm initialSettings={settings} />
      ) : (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Настройки не найдены. Примените миграцию базы данных.
        </div>
      )}
    </div>
  );
}
