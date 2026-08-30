import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPageContent } from "@/components/dashboard/settings/settings-page-content";
import { SiteHeader } from "@/components/site-header";
import { verifyAccess } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Настройки профиля",
  description: "Имя, email и роль вашего аккаунта",
};

export default async function SettingsPage() {
  const { user } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
    "student",
  ]);

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/");
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <SettingsPageContent
            userId={profile.id}
            email={user.email ?? "—"}
            role={profile.role}
            defaultFullName={profile.full_name ?? ""}
            avatarUrl={profile.avatar_url}
            displayName={displayName}
          />
        </div>
      </div>
    </>
  );
}
