import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { WithSiteHeader } from "@/components/site/with-site-header";

/** Прежняя главная страница (тесты / админка) — сохранена по запросу. */
export default function ArchiveHomePage() {
  return (
    <WithSiteHeader>
      <main className="flex flex-1 flex-col items-center gap-10 p-6 pt-10">
      <div className="space-y-4 text-center">
        <div className="mx-auto max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Образовательные тесты
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Создавайте задания или проходите готовые тесты по одному вопросу за раз.
          </p>
        </div>

        <div className="flex justify-center">
          <Link
            href="/dashboard/tests"
            className={buttonVariants({ size: "lg" })}
          >
            Начать работу
          </Link>
        </div>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/tests" className="group block h-full">
          <Card className="hover:border-primary/40 h-full min-h-40 transition-colors group-hover:shadow-md">
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">Админка</CardTitle>
              <CardDescription>
                Список тестов и удаление; отсюда же можно перейти к созданию.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/tests/create" className="group block h-full">
          <Card className="hover:border-primary/40 h-full min-h-40 transition-colors group-hover:shadow-md">
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">Создать тест</CardTitle>
              <CardDescription>
                Название, описание, вопросы и варианты ответов — всё в одной
                форме.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/test" className="group block h-full sm:col-span-2 lg:col-span-1">
          <Card className="hover:border-primary/40 h-full min-h-40 transition-colors group-hover:shadow-md">
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">Пройти тесты</CardTitle>
              <CardDescription>
                Выберите тест из списка и отвечайте по шагам с индикатором
                прогресса.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
    </WithSiteHeader>
  );
}
