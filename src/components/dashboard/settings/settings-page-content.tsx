"use client";

import { updateProfileName } from "@/app/actions/profile-actions";
import { AvatarUpload } from "@/components/dashboard/settings/avatar-upload";
import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/types/database.types";
import type { TranslationKey } from "@/lib/i18n/dict";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

type SettingsPageContentProps = {
  userId: string;
  email: string;
  role: ProfileRole;
  defaultFullName: string;
  avatarUrl: string | null;
  displayName: string;
  feedbackKey: "saved" | "empty_name" | "update_failed" | null;
};

function roleLabel(role: ProfileRole, t: (key: TranslationKey) => string): string {
  switch (role) {
    case "teacher":
      return t("settings.roleTeacher");
    case "admin":
      return t("settings.roleAdmin");
    case "student":
      return t("settings.roleStudent");
    default:
      return role;
  }
}

export function SettingsPageContent({
  userId,
  email,
  role,
  defaultFullName,
  avatarUrl,
  displayName,
  feedbackKey,
}: SettingsPageContentProps) {
  const { t } = useLanguage();

  const feedbackMessage =
    feedbackKey === "saved"
      ? t("settings.savedSuccess")
      : feedbackKey === "empty_name"
        ? t("settings.errorEmptyName")
        : feedbackKey === "update_failed"
          ? t("settings.errorUpdateFailed")
          : null;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("settings.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.pageSubtitle")}
        </p>
      </div>

      <div className="px-4 lg:px-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{t("settings.account")}</CardTitle>
            <CardDescription>{t("settings.accountDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AvatarUpload
              userId={userId}
              initialAvatarUrl={avatarUrl}
              displayName={displayName}
            />

            <div className="space-y-2">
              <Label htmlFor="email">{t("settings.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                readOnly
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>{t("settings.role")}</Label>
              <div>
                <Badge variant="secondary">{roleLabel(role, t)}</Badge>
              </div>
            </div>

            <form action={updateProfileName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("settings.fullName")}</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  defaultValue={defaultFullName}
                  placeholder={t("settings.fullNamePlaceholder")}
                  autoComplete="name"
                  required
                />
              </div>
              {feedbackMessage ? (
                <p
                  className={
                    feedbackKey === "saved"
                      ? "text-sm text-green-600 dark:text-green-500"
                      : "text-destructive text-sm"
                  }
                >
                  {feedbackMessage}
                </p>
              ) : null}
              <Button type="submit">{t("settings.save")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
