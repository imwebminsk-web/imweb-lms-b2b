import type { Metadata } from "next";
import Link from "next/link";

import { getTests } from "@/app/actions/test-actions";
import { TestRowActions } from "@/components/admin/tests/TestRowActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Тесты",
  description: "Список тестов и удаление",
};

export default async function DashboardTestsPage() {
  const result = await getTests();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Тесты (админка)
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Удаление доступно только при соответствующих политиках RLS в
            Supabase.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/tests/create"
            className={cn(buttonVariants({ size: "default" }))}
          >
            Создать тест
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
            )}
          >
            На главную
          </Link>
        </div>
      </div>

      {!result.success ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Не удалось загрузить список</CardTitle>
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
        <ul className="flex flex-col gap-3">
          {result.data.map((test) => (
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
      )}
    </main>
  );
}
