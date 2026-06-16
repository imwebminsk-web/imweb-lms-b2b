import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getOrCreateAttempt, getTestWithQuestions } from "@/app/actions/test-actions";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { WithSiteHeader } from "@/components/site/with-site-header";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getTestWithQuestions(id);
  if (!res.success) {
    if (res.kind === "not_found") {
      return { title: "Тест не найден" };
    }
    return { title: "Ошибка загрузки теста" };
  }
  return { title: res.data.title };
}

function TestLoadError({
  id,
  message,
  kind,
}: {
  id: string;
  message: string;
  kind?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link
        href="/test"
        className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
      >
        ← К списку тестов
      </Link>
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-6">
        <h1 className="text-destructive text-lg font-semibold">
          Не удалось загрузить тест
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Запрошенный id:{" "}
          <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
            {id}
          </code>
          {kind ? (
            <>
              {" "}
              · тип: <code className="text-xs">{kind}</code>
            </>
          ) : null}
        </p>
        <p className="text-foreground mt-3 text-sm">{message}</p>
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          Если видите ошибку авторизации (Auth) или «permission denied» — проверьте
          вход, переменные <code>NEXT_PUBLIC_SUPABASE_*</code> и политики RLS для
          таблиц <code>tests</code>, <code>questions</code>, <code>options</code>.
        </p>
        <Link
          href="/login"
          className="text-primary mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Вход
        </Link>
      </div>
    </main>
  );
}

export default async function TestViewPage({ params }: PageProps) {
  const { id } = await params;

  console.log("[TestViewPage] загрузка страницы теста", { id });

  const res = await getTestWithQuestions(id);

  if (!res.success) {
    if (res.kind === "not_found") {
      notFound();
    }
    return (
      <WithSiteHeader>
        <TestLoadError
          id={id}
          message={res.error}
          kind={res.kind}
        />
      </WithSiteHeader>
    );
  }

  const { data } = res;
  const attempt = await getOrCreateAttempt(id);

  return (
    <WithSiteHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/test"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Все тесты
        </Link>
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          Вход
        </Link>
      </div>

      {!attempt.success ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-6 text-center">
          <p className="text-destructive text-sm">{attempt.error}</p>
          {attempt.needAuth ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/test/${id}`)}`}
              className="text-primary mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Перейти ко входу
            </Link>
          ) : null}
        </div>
      ) : (
        <QuizPlayer
          attemptId={attempt.attemptId}
          testTitle={data.title}
          testDescription={data.description}
          questions={data.questions}
          isForKids={data.is_for_kids}
          timeLimitMinutes={data.time_limit ?? 0}
        />
      )}
    </main>
    </WithSiteHeader>
  );
}
