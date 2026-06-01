import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { updateProfileName } from "@/app/actions/profile-actions";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export const metadata: Metadata = {
  title: "Настройки профиля",
  description: "Имя, email и роль вашего аккаунта",
};

type ProfileRole = Database["public"]["Enums"]["profile_role"];

function roleLabel(role: ProfileRole): string {
  switch (role) {
    case "teacher":
      return "Преподаватель";
    case "admin":
      return "Администратор";
    case "student":
      return "Ученик";
    default:
      return role;
  }
}

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
    .select("full_name, role")
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
  const feedbackMessage =
    params.saved === "1"
      ? "Имя успешно сохранено."
      : params.error === "empty_name"
        ? "Укажите имя и фамилию."
        : params.error === "update_failed"
          ? "Не удалось сохранить изменения. Попробуйте снова."
          : null;

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                Настройки профиля
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Обновите отображаемое имя и просмотрите данные аккаунта.
              </p>
            </div>

            <div className="px-4 lg:px-6">
              <Card className="max-w-lg">
                <CardHeader>
                  <CardTitle>Аккаунт</CardTitle>
                  <CardDescription>
                    Email и роль доступны только для просмотра.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={user.email ?? "—"}
                      readOnly
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Роль</Label>
                    <div>
                      <Badge variant="secondary">{roleLabel(profile.role)}</Badge>
                    </div>
                  </div>

                  <form action={updateProfileName} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Имя и фамилия</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        defaultValue={profile.full_name ?? ""}
                        placeholder="Как вас показывать в системе"
                        autoComplete="name"
                        required
                      />
                    </div>
                    {feedbackMessage ? (
                      <p
                        className={
                          params.saved === "1"
                            ? "text-sm text-green-600 dark:text-green-500"
                            : "text-destructive text-sm"
                        }
                      >
                        {feedbackMessage}
                      </p>
                    ) : null}
                    <Button type="submit">Сохранить</Button>
                  </form>
                </CardContent>
                <CardFooter className="text-muted-foreground text-sm">
                  Имя отображается в боковом меню и в интерфейсе для
                  учеников.
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
