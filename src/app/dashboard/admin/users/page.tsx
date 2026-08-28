import type { Metadata } from "next";

import { CorporateUsersTable } from "@/components/admin/users/corporate-users-table";
import { UsersTable } from "@/components/dashboard/admin/users-table";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_MODE } from "@/lib/config/app-mode";
import { createClient } from "@/lib/supabase/server";

import { fetchAdminUsers } from "@/app/dashboard/fetch-dashboard-data";

import { verifyAccess } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Пользователи",
  description: "Управление пользователями платформы",
};

type AdminUsersContentProps = {
  adminUsers: Awaited<ReturnType<typeof fetchAdminUsers>>;
  currentUserId: string;
};

function AdminUsersContent({
  adminUsers,
  currentUserId,
}: AdminUsersContentProps) {
  if (APP_MODE === "school") {
    return (
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <UsersTable users={adminUsers} currentUserId={currentUserId} />
      </section>
    );
  }

  if (APP_MODE === "corporate") {
    return (
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <CorporateUsersTable />
      </section>
    );
  }

  return (
    <Tabs defaultValue="school" className="w-full">
      <TabsList variant="line" className="mb-6 w-full justify-start">
        <TabsTrigger value="school">Школа (B2C)</TabsTrigger>
        <TabsTrigger value="corporate">Корпорация (B2B)</TabsTrigger>
      </TabsList>
      <TabsContent value="school" className="mt-0">
        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <UsersTable users={adminUsers} currentUserId={currentUserId} />
        </section>
      </TabsContent>
      <TabsContent value="corporate" className="mt-0">
        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <CorporateUsersTable />
        </section>
      </TabsContent>
    </Tabs>
  );
}

function usersPageSubtitle(): string {
  if (APP_MODE === "school") {
    return "Изменение ролей, сброс паролей и удаление аккаунтов.";
  }
  if (APP_MODE === "corporate") {
    return "Управление корпоративными пользователями, отделами и тегами.";
  }
  return "Управление пользователями школы и корпорации.";
}

export default async function AdminUsersPage() {
  const { user, profile } = await verifyAccess(["admin"]);
  const supabase = await createClient();

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Администратор";

  const adminUsers = await fetchAdminUsers(supabase);

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Пользователи
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {usersPageSubtitle()}
            </p>
          </div>
          <AdminUsersContent
            adminUsers={adminUsers}
            currentUserId={user.id}
          />
        </main>
      </div>
    </>
  );
}
