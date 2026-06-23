import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPageContent } from "@/components/dashboard/settings/settings-page-content";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Настройки профиля",
  description: "Имя, email и роль вашего аккаунта",
};

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login");
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  const params = await searchParams;
  const feedbackKey =
    params.saved === "1"
      ? ("saved" as const)
      : params.error === "empty_name"
        ? ("empty_name" as const)
        : params.error === "update_failed"
          ? ("update_failed" as const)
          : null;

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <SettingsPageContent
            userId={user.id}
            email={user.email ?? "—"}
            role={profile.role}
            defaultFullName={profile.full_name ?? ""}
            avatarUrl={profile.avatar_url}
            displayName={displayName}
            feedbackKey={feedbackKey}
          />
        </div>
      </div>
    </>
  );
}
