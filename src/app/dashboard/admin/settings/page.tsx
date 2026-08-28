import type { Metadata } from "next";

import { getPlatformSettings } from "@/app/actions/settings-actions";
import { PlatformSettingsForm } from "@/components/dashboard/admin/platform-settings-form";
import { SiteHeader } from "@/components/site-header";
import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Настройки платформы",
  description: "Внешний вид, контакты и брендинг платформы",
};

export default async function AdminSettingsPage() {
  const { user, profile } = await verifyAccess(["admin"]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Администратор";

  const settings = await getPlatformSettings();

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Настройки платформы
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Настройки внешнего вида и брендинга платформы
            </p>
          </div>

          {settings ? (
            <PlatformSettingsForm initialSettings={settings} />
          ) : (
            <div className="text-muted-foreground rounded-md border p-8 text-center">
              Настройки не найдены. Примените миграцию базы данных.
            </div>
          )}
        </main>
      </div>
    </>
  );
}
