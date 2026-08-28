import type { Metadata } from "next";

import { getTests } from "@/app/actions/test-actions";
import { TestsAdminClient } from "@/components/dashboard/tests/tests-admin-client";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Тесты",
  description: "Список тестов преподавателя",
};

export default async function DashboardTestsPage() {
  const { user, profile } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
  ]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  const canHardDelete = profile.role === "admin";
  const canChangeOwner =
    profile.role === "admin" || profile.role === "head_teacher";

  const [activeResult, archivedResult] = await Promise.all([
    getTests(false),
    getTests(true),
  ]);

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Тесты</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Библиотека тестов: создание, редактирование и прохождение в
              песочнице.
            </p>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList variant="line" className="mb-6 w-full justify-start">
              <TabsTrigger value="active">Активные</TabsTrigger>
              <TabsTrigger value="archive">Архив</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              <TestsAdminClient
                tests={activeResult.success ? activeResult.data : []}
                error={activeResult.success ? undefined : activeResult.error}
                isArchived={false}
                canHardDelete={canHardDelete}
                canChangeOwner={canChangeOwner}
              />
            </TabsContent>

            <TabsContent value="archive" className="mt-0">
              <TestsAdminClient
                tests={archivedResult.success ? archivedResult.data : []}
                error={
                  archivedResult.success ? undefined : archivedResult.error
                }
                isArchived
                canHardDelete={canHardDelete}
                canChangeOwner={canChangeOwner}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
