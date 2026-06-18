"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/components/providers/language-provider";
import {
  collectPublishedLessonIds,
  publishedLessonsSorted,
  sortModules,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

export type LessonNavigationProps = {
  courseSlug: string;
  modules: LearnModuleNav[];
  currentLessonId: string;
  completedLessonIds?: string[];
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
  completedLessonIds = [],
}: LessonNavigationProps) {
  const { t } = useLanguage();
  const allLessons = flattenPublishedLessons(modules);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  const prevLesson =
    currentIndex > 0 ? allLessons[currentIndex - 1]! : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]!
      : null;

  const hubHref = `/learn/${encodeURIComponent(courseSlug)}`;

  const completedSet = useMemo(
    () => new Set(completedLessonIds),
    [completedLessonIds],
  );
  const publishedLessonIds = useMemo(
    () => collectPublishedLessonIds(modules),
    [modules],
  );
  const completedLessonsCount = publishedLessonIds.filter((id) =>
    completedSet.has(id),
  ).length;
  const totalLessonsCount = publishedLessonIds.length;
  const allLessonsCompleted =
    totalLessonsCount > 0 && completedLessonsCount >= totalLessonsCount;

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
          <span className="text-muted-foreground text-sm">
            {t("lesson_view.firstLesson")}
          </span>
        )}
      </div>

      <div className="flex w-full flex-col items-end gap-1 sm:w-auto sm:max-w-[45%]">
        {nextLesson ? (
          <Button asChild className="max-w-full">
            <Link
              href={`/learn/${encodeURIComponent(courseSlug)}/${nextLesson.id}`}
              className="flex min-w-0 items-center"
            >
              <span className="truncate">{t("lesson_view.nextLesson")}</span>
              <ChevronRight className="ml-2 size-4 shrink-0" aria-hidden />
            </Link>
          </Button>
        ) : allLessonsCompleted ? (
          <Button variant="secondary" asChild className="max-w-full">
            <Link href={hubHref} className="inline-flex items-center">
              {t("lesson_view.finishCourse")}
              <CheckCircle className="ml-2 size-4 shrink-0" aria-hidden />
            </Link>
          </Button>
        ) : (
          <>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="secondary"
                      className="max-w-full"
                      disabled
                    >
                      {t("lesson_view.finishCourse")}
                      <CheckCircle className="ml-2 size-4 shrink-0" aria-hidden />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-center">
                  {t("lesson_view.finishCourseDisabledHint")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-muted-foreground text-right text-xs">
              {t("lesson_view.finishCourseDisabledHint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
