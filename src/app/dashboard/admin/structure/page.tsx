import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Оргструктура компании",
  description: "Управление отделами, должностями и назначением курсов",
};

export default async function AdminStructurePage() {
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

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Оргструктура компании
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Здесь HR-менеджер настраивает отделы и должности, а также
            назначает курсы командам и ролям. Изменения в матрице автоматически
            выдают или отзывают доступ сотрудникам.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Отделы (Teams)</CardTitle>
              <CardDescription>
                Дерево подразделений компании и привязка курсов к отделам.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Раздел в разработке — скоро здесь появится список отделов.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Должности (Job Titles)</CardTitle>
              <CardDescription>
                Справочник должностей и матрица «должность → курс».
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Раздел в разработке — скоро здесь появится список должностей.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
