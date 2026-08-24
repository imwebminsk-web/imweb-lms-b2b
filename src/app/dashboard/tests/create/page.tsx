import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateTestForm } from "@/components/admin/create-test-form";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Создать тест",
  description: "Новый тест с вопросами",
};

export default async function DashboardCreateTestPage() {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Создание теста
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Типы вопросов: один ответ, несколько верных, пазл (клик) или
                супер-пазл (перетаскивание) — для пазлов заполняйте левую и
                правую часть каждой пары.
              </p>
            </div>
            <Link
              href="/dashboard/tests"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Все тесты
            </Link>
          </div>
          <CreateTestForm />
        </main>
      </div>
    </>
  );
}
