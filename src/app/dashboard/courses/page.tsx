import type { Metadata } from "next";

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
  title: "Мои курсы",
  description: "Курсы преподавателя и создание нового курса",
};

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
  const defaultTab = showCorporateTab ? "b2b" : showOpenTab ? "b2c" : "archive";

  const [{ data: b2bData }, { data: b2cData }, archivedResult] = await Promise.all([
    showCorporateTab
      ? getB2BCourses(user.id)
      : Promise.resolve({ data: null, error: null }),
    showOpenTab
      ? getB2CCourses(user.id)
      : Promise.resolve({ data: null, error: null }),
    isAdmin
      ? getArchivedCourses()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const archivedData = archivedResult.data;

  const subtitle = showCorporateTab && showOpenTab
    ? "Управляйте корпоративными и открытыми курсами в одном месте."
    : showCorporateTab
      ? "Управляйте корпоративными курсами в одном месте."
      : "Управляйте открытыми курсами в одном месте.";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Мои курсы</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {subtitle}
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-auto">
              <CreateCourseButton />
            </div>
          </div>

          <Tabs defaultValue={defaultTab}>
            <TabsList>
              {showCorporateTab ? (
                <TabsTrigger value="b2b">Корпоративные (B2B)</TabsTrigger>
              ) : null}
              {showOpenTab ? (
                <TabsTrigger value="b2c">Открытые</TabsTrigger>
              ) : null}
              {isAdmin ? (
                <TabsTrigger value="archive">Архив</TabsTrigger>
              ) : null}
            </TabsList>
            {showCorporateTab ? (
              <TabsContent value="b2b" className="mt-4">
                <B2BCoursesTable data={b2bData || []} currentUser={currentUser} />
              </TabsContent>
            ) : null}
            {showOpenTab ? (
              <TabsContent value="b2c" className="mt-4">
                <B2CCoursesTable data={b2cData || []} currentUser={currentUser} />
              </TabsContent>
            ) : null}
            {isAdmin ? (
              <TabsContent value="archive" className="mt-4">
                <ArchivedCoursesTable
                  data={archivedData || []}
                  currentUser={currentUser}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </main>
      </div>
    </>
  );
}
