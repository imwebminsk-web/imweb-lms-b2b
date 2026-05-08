import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getFirstPublishedLessonId } from "@/lib/learn/curriculum-order";
import { fetchPublishedCourseForLearn } from "@/lib/learn/fetch-published-course";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export default async function LearnCourseEntryPage({ params }: PageProps) {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/learn/${slugParam}`)}`,
    );
  }

  const course = await fetchPublishedCourseForLearn(decodedSlug, user.id);
  if (!course) {
    notFound();
  }

  const firstId = getFirstPublishedLessonId(course.modules);
  if (firstId) {
    redirect(`/learn/${encodeURIComponent(course.slug)}/${firstId}`);
  }

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Курс пуст</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        В этом курсе пока нет опубликованных уроков. Загляните позже или
        вернитесь на страницу курса.
      </p>
      <Button asChild variant="secondary">
        <Link href={`/courses/${encodeURIComponent(course.slug)}`}>
          На страницу курса
        </Link>
      </Button>
    </main>
  );
}
