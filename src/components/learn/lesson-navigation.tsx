import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  publishedLessonsSorted,
  sortModules,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

export type LessonNavigationProps = {
  courseSlug: string;
  modules: LearnModuleNav[];
  currentLessonId: string;
};

function flattenPublishedLessons(
  modules: LearnModuleNav[],
): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const mod of sortModules(modules)) {
    for (const l of publishedLessonsSorted(mod.lessons)) {
      out.push({ id: l.id, title: l.title });
    }
  }
  return out;
}

export function LessonNavigation({
  courseSlug,
  modules,
  currentLessonId,
}: LessonNavigationProps) {
  const allLessons = flattenPublishedLessons(modules);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  const prevLesson =
    currentIndex > 0 ? allLessons[currentIndex - 1]! : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]!
      : null;

  const hubHref = `/learn/${encodeURIComponent(courseSlug)}`;

  return (
    <div className="border-border mt-8 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row sm:items-center">
      <div className="flex w-full min-w-0 justify-start sm:w-auto sm:max-w-[45%]">
        {prevLesson ? (
          <Button variant="outline" asChild className="max-w-full">
            <Link
              href={`/learn/${encodeURIComponent(courseSlug)}/${prevLesson.id}`}
              className="flex min-w-0 items-center"
            >
              <ChevronLeft className="mr-2 size-4 shrink-0" aria-hidden />
              <span className="truncate">{prevLesson.title}</span>
            </Link>
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">Первый урок</span>
        )}
      </div>

      <div className="flex w-full justify-end sm:w-auto sm:max-w-[45%]">
        {nextLesson ? (
          <Button asChild className="max-w-full">
            <Link
              href={`/learn/${encodeURIComponent(courseSlug)}/${nextLesson.id}`}
              className="flex min-w-0 items-center"
            >
              <span className="truncate">Следующий урок</span>
              <ChevronRight className="ml-2 size-4 shrink-0" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" asChild>
            <Link href={hubHref} className="inline-flex items-center">
              Завершить курс
              <CheckCircle className="ml-2 size-4 shrink-0" aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
