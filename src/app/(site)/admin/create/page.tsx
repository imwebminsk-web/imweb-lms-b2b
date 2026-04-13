import type { Metadata } from "next";
import Link from "next/link";

import { CreateTestForm } from "@/components/admin/create-test-form";

export const metadata: Metadata = {
  title: "Создать тест",
  description: "Админка: новый тест с вопросами",
};

export default function AdminCreateTestPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Создание теста
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Типы вопросов: один ответ, несколько верных, пазл (клик) или
            супер-пазл (перетаскивание) — для пазлов заполняйте левую и правую
            часть каждой пары.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Все тесты
          </Link>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            На главную
          </Link>
        </div>
      </div>
      <CreateTestForm />
    </main>
  );
}
