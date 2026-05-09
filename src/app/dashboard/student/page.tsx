import Link from "next/link";
import { redirect } from "next/navigation";

import { getStudentProgress } from "@/app/actions/student-dashboard-actions";
import { StudentProgressClient } from "@/components/dashboard/student/student-progress-client";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function StudentDashboardPage() {
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

  if (profile.role !== "student") {
    redirect("/dashboard");
  }

  const progressRes = await getStudentProgress(user.id);
  if (!progressRes.success) {
    throw new Error(progressRes.error);
  }

  const items = progressRes.items;
  const needsAttention = items.filter(
    (i) => i.type === "assignment" && i.status === "rejected",
  );

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Моё обучение
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Прогресс по тестам и заданиям в курсах, на которые вы записаны.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Требует внимания
            </h2>
            {needsAttention.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Нет заданий, возвращённых на доработку.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {needsAttention.map((item) => {
                  const href = `/learn/${encodeURIComponent(item.courseSlug)}/${item.lessonId}`;
                  return (
                    <li key={item.id}>
                      <Alert variant="destructive">
                        <AlertTitle>Задание на доработку</AlertTitle>
                        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm">{item.title}</span>
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={href}>Перейти к уроку</Link>
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Моя успеваемость
            </h2>
            <StudentProgressClient
              userId={user.id}
              userDisplayName={displayName}
              items={items}
            />
          </section>
        </main>
      </div>
    </>
  );
}
