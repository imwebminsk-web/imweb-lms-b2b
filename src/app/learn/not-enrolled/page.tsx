import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Нет доступа к курсу",
  description: "Вы не записаны на этот курс",
};

type PageProps = {
  searchParams: Promise<{ slug?: string; reason?: string }>;
};

function accessCopy(reason: string | undefined): {
  title: string;
  description: string;
} {
  if (reason === "pending") {
    return {
      title: "Нет доступа к курсу",
      description:
        "Ваша заявка находится на рассмотрении. Ожидайте одобрения преподавателя.",
    };
  }
  if (reason === "suspended") {
    return {
      title: "Нет доступа к курсу",
      description:
        "Доступ к курсу приостановлен. Обратитесь к преподавателю.",
    };
  }
  return {
    title: "Нет доступа к курсу",
    description: "У вас нет доступа к этому курсу.",
  };
}

export default async function LearnNotEnrolledPage({ searchParams }: PageProps) {
  const { slug, reason } = await searchParams;
  const courseSlug = slug?.trim();
  const copy = accessCopy(reason?.trim());

  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg items-center justify-center py-12">
      <Card className="w-full rounded-xl">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-xl">
            <Link href="/dashboard">Перейти в кабинет</Link>
          </Button>
          {courseSlug ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/courses/${encodeURIComponent(courseSlug)}`}>
                Страница курса
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
