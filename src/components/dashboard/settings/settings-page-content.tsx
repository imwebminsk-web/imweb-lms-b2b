"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import {
  updateProfileSchema,
  type UpdateProfilePayload,
} from "@/lib/validations/profile-schema";
import { getRoleTranslation } from "@/lib/utils/role-utils";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

type SettingsPageContentProps = {
  userId: string;
  email: string;
  role: ProfileRole;
  defaultFullName: string;
  avatarUrl: string | null;
  displayName: string;
};

export function SettingsPageContent({
  userId,
  email,
  role,
  defaultFullName,
  avatarUrl,
  displayName,
}: SettingsPageContentProps) {
  const { t } = useLanguage();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfilePayload>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: defaultFullName },
  });

  async function onSubmit(values: UpdateProfilePayload) {
    const result = await updateProfileName(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("settings.savedSuccess"));
  }

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
                <Badge variant="secondary">{getRoleTranslation(role)}</Badge>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("settings.fullName")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t("settings.fullNamePlaceholder")}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                  disabled={isSubmitting}
                  {...register("fullName")}
                />
                {errors.fullName?.message ? (
                  <p className="text-destructive text-sm" role="alert">
                    {errors.fullName.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("settings.saving") : t("settings.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
