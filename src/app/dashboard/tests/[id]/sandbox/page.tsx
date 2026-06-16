import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getTestWithQuestions,
  resetAndCreatePreviewAttempt,
} from "@/app/actions/test-actions";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

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
  return { title: `${res.data.title} — песочница` };
}

export default async function DashboardTestSandboxPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/tests/${id}/sandbox`)}`,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    redirect("/dashboard");
  }

  const [testRes, attempt] = await Promise.all([
    getTestWithQuestions(id),
    resetAndCreatePreviewAttempt(id),
  ]);

  if (!testRes.success) {
    if (testRes.kind === "not_found") {
      notFound();
    }
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <Link
          href="/dashboard/tests"
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "text-muted-foreground w-fit",
          )}
        >
          ← Назад к списку
        </Link>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Не удалось загрузить тест</CardTitle>
            <CardDescription className="text-destructive">
              {testRes.error}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { data } = testRes;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <Link
        href="/dashboard/tests"
        className={cn(
          buttonVariants({ variant: "ghost", size: "default" }),
          "text-muted-foreground w-fit",
        )}
      >
        ← Назад к списку
      </Link>

      {!attempt.success ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Не удалось начать попытку</CardTitle>
            <CardDescription className="text-destructive">
              {attempt.error}
            </CardDescription>
            {attempt.needAuth ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/dashboard/tests/${id}/sandbox`)}`}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "mt-4 inline-flex w-fit",
                )}
              >
                Перейти ко входу
              </Link>
            ) : null}
          </CardHeader>
        </Card>
      ) : (
        <QuizPlayer
          isSandbox
          attemptId={attempt.attemptId}
          testTitle={data.title}
          testDescription={data.description}
          questions={data.questions}
          isForKids={data.is_for_kids}
          timeLimitMinutes={data.time_limit ?? 0}
        />
      )}
    </main>
  );
}
