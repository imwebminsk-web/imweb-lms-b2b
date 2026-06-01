import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getTests } from "@/app/actions/test-actions";
import { TestRowActions } from "@/components/admin/tests/TestRowActions";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Тесты",
  description: "Список тестов преподавателя",
};

export default async function DashboardTestsPage() {
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

  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  const result = await getTests();
  const groupedTests = result.success
    ? result.data.reduce(
        (acc, test) => {
          const normalizedFolder = test.folder_name?.trim();
          const folder =
            normalizedFolder && normalizedFolder.length > 0
              ? normalizedFolder
              : "Без папки";
          const bucket = acc.get(folder) ?? [];
          bucket.push(test);
          acc.set(folder, bucket);
          return acc;
        },
        new Map<string, typeof result.data>(),
      )
    : new Map<string, never[]>();
  const folderGroups = [...groupedTests.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "ru"),
  );

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Тесты</h1>
            <Link
              href="/dashboard/tests/create"
              className={cn(buttonVariants({ size: "default" }))}
            >
              Создать тест
            </Link>
          </div>

          {!result.success ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-base">
                  Не удалось загрузить список
                </CardTitle>
                <CardDescription className="text-destructive">
                  {result.error}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : result.data.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Пока нет тестов</CardTitle>
                <CardDescription>Создайте первый тест.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Link
                  href="/dashboard/tests/create"
                  className={cn(buttonVariants({ size: "default" }))}
                >
                  Создать тест
                </Link>
              </CardFooter>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {folderGroups.map(([folderName, tests]) => (
                <AccordionItem
                  key={folderName}
                  value={folderName}
                  className="rounded-lg border px-4"
                >
                  <AccordionTrigger className="py-3">
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">{folderName}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {tests.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <ul className="flex flex-col gap-3">
                      {tests.map((test) => (
                        <li key={test.id}>
                          <Card className="flex flex-row items-center gap-4 p-4">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="line-clamp-1 text-lg font-medium leading-snug">
                                {test.title}
                              </p>
                              {test.description ? (
                                <p className="text-muted-foreground line-clamp-1 text-sm">
                                  {test.description}
                                </p>
                              ) : (
                                <p className="text-muted-foreground/70 line-clamp-1 text-sm italic">
                                  Без описания
                                </p>
                              )}
                              <Badge variant="secondary" className="tabular-nums">
                                Вопросов: {test.totalQuestions}
                              </Badge>
                            </div>
                            <TestRowActions testId={test.id} />
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </main>
      </div>
    </>
  );
}
