import type { Metadata } from "next";
import Link from "next/link";

import { getTests } from "@/app/actions/test-actions";
import { DeleteTestButton } from "@/components/admin/tests/DeleteTestButton";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((test) => (
            <li key={test.id}>
              <Card className="flex h-full flex-col">
                <CardHeader className="flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    <CardTitle className="line-clamp-2 min-w-0 flex-1 text-lg leading-snug">
                      {test.title}
                    </CardTitle>
                    <DeleteTestButton testId={test.id} />
                  </div>
                  {test.description ? (
                    <CardDescription className="line-clamp-3">
                      {test.description}
                    </CardDescription>
                  ) : (
                    <CardDescription className="text-muted-foreground/70 italic">
                      Без описания
                    </CardDescription>
                  )}
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Вопросов: {test.totalQuestions}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href={`/test/${test.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "w-full justify-center",
                    )}
                  >
                    Открыть как ученик
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
