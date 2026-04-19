import type { Metadata } from "next";
import Link from "next/link";

import { getTests } from "@/app/actions/test-actions";
import { Badge } from "@/components/ui/badge";
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
import { WithSiteHeader } from "@/components/site/with-site-header";

export const metadata: Metadata = {
  title: "Тесты",
  description: "Список доступных тестов",
};

function statusBadge(userStatus: "not_started" | "in_progress" | "completed") {
  switch (userStatus) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-emerald-600/45 bg-emerald-500/12 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100"
        >
          Пройдено
        </Badge>
      );
    case "in_progress":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100"
        >
          В процессе
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Не начато
        </Badge>
      );
  }
}

function actionLabel(userStatus: "not_started" | "in_progress" | "completed") {
  if (userStatus === "completed") return "Пересдать";
  if (userStatus === "in_progress") return "Продолжить";
  return "Начать тест";
}

export default async function TestsListPage() {
  const result = await getTests();

  return (
    <WithSiteHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Доступные тесты
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Статус и лучший результат видны после входа. Серым отмечены тесты,
            которые ещё не открывали.
          </p>
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "default" }))}
        >
          Назад на главную
        </Link>
      </div>

      {!result.success ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Не удалось загрузить список</CardTitle>
            <CardDescription className="text-destructive">
              {result.error}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <p className="text-muted-foreground text-xs">
              После настройки RLS в Supabase для чтения таблиц{" "}
              <code className="bg-muted rounded px-1">tests</code>,{" "}
              <code className="bg-muted rounded px-1">questions</code> и{" "}
              <code className="bg-muted rounded px-1">student_attempts</code>{" "}
              список появится здесь.
            </p>
          </CardFooter>
        </Card>
      ) : result.data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Пока нет тестов</CardTitle>
            <CardDescription>
              Создайте первый тест на странице админки.
            </CardDescription>
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
                <CardHeader className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 flex-1 text-lg leading-snug">
                      {test.title}
                    </CardTitle>
                    {statusBadge(test.userStatus)}
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
                  {test.hasCompletedAttempt &&
                  test.bestScore !== null &&
                  test.totalQuestions > 0 ? (
                    <p className="text-foreground text-sm font-medium tabular-nums">
                      Результат: {test.bestScore}/{test.totalQuestions}
                    </p>
                  ) : test.hasCompletedAttempt && test.totalQuestions === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Пройдено (в тесте нет вопросов)
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href={`/test/${test.id}`}
                    className={cn(
                      buttonVariants({ size: "default" }),
                      "w-full justify-center",
                    )}
                  >
                    {actionLabel(test.userStatus)}
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
    </WithSiteHeader>
  );
}
