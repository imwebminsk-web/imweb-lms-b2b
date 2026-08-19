import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CorporateUsersTable } from "@/components/admin/users/corporate-users-table";
import { UsersTable } from "@/components/dashboard/admin/users-table";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_MODE } from "@/lib/config/app-mode";
import { createClient } from "@/lib/supabase/server";

import { fetchAdminUsers } from "@/app/dashboard/fetch-dashboard-data";

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
    return <UsersTable users={adminUsers} currentUserId={currentUserId} />;
  }

  if (APP_MODE === "corporate") {
    return <CorporateUsersTable />;
  }

  return (
    <Tabs defaultValue="school">
      <TabsList className="mx-4 mb-4 h-auto flex-wrap rounded-xl lg:mx-6">
        <TabsTrigger value="school" className="rounded-lg">
          Школа (B2C)
        </TabsTrigger>
        <TabsTrigger value="corporate" className="rounded-lg">
          Корпорация (B2B)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="school" className="mt-0">
        <UsersTable users={adminUsers} currentUserId={currentUserId} />
      </TabsContent>
      <TabsContent value="corporate" className="mt-0">
        <CorporateUsersTable />
      </TabsContent>
    </Tabs>
  );
}

export default async function AdminUsersPage() {
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

  const adminUsers = await fetchAdminUsers(supabase);

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <AdminUsersContent
              adminUsers={adminUsers}
              currentUserId={user.id}
            />
          </div>
        </div>
      </div>
    </>
  );
}
