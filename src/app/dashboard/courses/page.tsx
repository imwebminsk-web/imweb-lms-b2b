import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  getArchivedCourses,
  getB2BCourses,
  getB2CCourses,
} from "@/app/actions/courses";
import { ArchivedCoursesTable } from "@/components/dashboard/courses/archived-courses-table";
import { B2BCoursesTable } from "@/components/dashboard/courses/b2b-courses-table";
import { B2CCoursesTable } from "@/components/dashboard/courses/b2c-courses-table";
import { CreateCourseButton } from "@/components/dashboard/courses/create-course-button";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { verifyAccess } from "@/lib/auth/rbac";
import { isCorporateMode, isSchoolMode } from "@/lib/config/app-mode";

export const metadata: Metadata = {
  title: "Курсы",
  description: "Курсы преподавателя и создание нового курса",
};

function CoursesTableCard({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-end border-b px-6 py-4">
        <CreateCourseButton />
      </div>
      {children}
    </section>
  );
}

export default async function DashboardCoursesPage() {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  const currentUser = { id: user.id, role: profile.role };
  const isAdmin = profile.role === "admin";
  const showCorporateTab = isCorporateMode;
  const showOpenTab = isSchoolMode;
  const showArchiveTab = isAdmin;
  const showTabsNav = isAdmin || (showCorporateTab && showOpenTab);
  const defaultTab = showCorporateTab ? "b2b" : showOpenTab ? "b2c" : "archive";

  const [{ data: b2bData }, { data: b2cData }, archivedResult] = await Promise.all([
    showCorporateTab
      ? getB2BCourses(user.id)
      : Promise.resolve({ data: null, error: null }),
    showOpenTab
      ? getB2CCourses(user.id)
      : Promise.resolve({ data: null, error: null }),
    showArchiveTab
      ? getArchivedCourses()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const archivedData = archivedResult.data;

  const subtitle = showCorporateTab && showOpenTab
    ? "Управляйте корпоративными и открытыми курсами в одном месте."
    : showCorporateTab
      ? "Управляйте корпоративными курсами в одном месте."
      : "Управляйте открытыми курсами в одном месте.";

  const b2bTable = showCorporateTab ? (
    <CoursesTableCard>
      <B2BCoursesTable data={b2bData || []} currentUser={currentUser} />
    </CoursesTableCard>
  ) : null;

  const b2cTable = showOpenTab ? (
    <CoursesTableCard>
      <B2CCoursesTable data={b2cData || []} currentUser={currentUser} />
    </CoursesTableCard>
  ) : null;

  const archiveTable = showArchiveTab ? (
    <CoursesTableCard>
      <ArchivedCoursesTable
        data={archivedData || []}
        currentUser={currentUser}
      />
    </CoursesTableCard>
  ) : null;

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Курсы</h1>
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          </div>

          {showTabsNav ? (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList variant="line" className="mb-6 w-full justify-start">
                {showCorporateTab ? (
                  <TabsTrigger value="b2b">Корпоративные (B2B)</TabsTrigger>
                ) : null}
                {showOpenTab ? (
                  <TabsTrigger value="b2c">Открытые</TabsTrigger>
                ) : null}
                {showArchiveTab ? (
                  <TabsTrigger value="archive">Архив</TabsTrigger>
                ) : null}
              </TabsList>
              {showCorporateTab ? (
                <TabsContent value="b2b" className="mt-0">
                  {b2bTable}
                </TabsContent>
              ) : null}
              {showOpenTab ? (
                <TabsContent value="b2c" className="mt-0">
                  {b2cTable}
                </TabsContent>
              ) : null}
              {showArchiveTab ? (
                <TabsContent value="archive" className="mt-0">
                  {archiveTable}
                </TabsContent>
              ) : null}
            </Tabs>
          ) : (
            b2bTable ?? b2cTable
          )}
        </main>
      </div>
    </>
  );
}
