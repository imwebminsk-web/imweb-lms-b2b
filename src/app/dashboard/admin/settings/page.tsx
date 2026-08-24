import { redirect } from "next/navigation";

import { getPlatformSettings } from "@/app/actions/settings-actions";
import { PlatformSettingsForm } from "@/components/dashboard/admin/platform-settings-form";
import { createClient } from "@/lib/supabase/server";
import { verifyAccess } from "@/lib/auth/rbac";

export default async function AdminSettingsPage() {
  await verifyAccess(["admin", "head_teacher"]);

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
