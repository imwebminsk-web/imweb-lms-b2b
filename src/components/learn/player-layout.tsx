"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import type { AssignmentSubmissionRow } from "@/app/actions/assignment-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  publishedLessonsSorted,
  sortModules,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import {
  LessonBlockRenderer,
  readTestId,
  type PlayerBlockRow,
} from "@/components/learn/lesson-block-renderer";
import { LessonNavigation } from "@/components/learn/lesson-navigation";
import { TestRevealWrapper } from "@/components/learn/test-reveal-wrapper";
import { useLanguage } from "@/components/providers/language-provider";
import { youtubeEmbedSrc } from "@/lib/learn/youtube-embed";
import { cn } from "@/lib/utils";
import type { Database, Json } from "@/types/database.types";
import { ArrowLeft, FileText, ListChecks, Video } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type LessonType = Database["public"]["Enums"]["lesson_type"];

export type PlayerLessonPayload = {
  id: string;
  title: string;
  type: LessonType;
  content: Json;
  test_id: string | null;
};

type PlayerLayoutProps = {
  courseSlug: string;
  courseTitle: string;
  activeLessonId: string;
  modules: LearnModuleNav[];
  lesson: PlayerLessonPayload;
  blocks: PlayerBlockRow[];
  /** Сдачи по блокам type=assignment (ключ — id блока). */
  assignmentSubmissionsByBlockId?: Record<
    string,
    AssignmentSubmissionRow | null
  >;
  /** Блок под контентом урока (например кнопка «Завершить урок»). */
  lessonCompletion?: ReactNode;
};

function readVideoUrl(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.videoUrl === "string" ? c.videoUrl : "";
}

function readBody(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.body === "string" ? c.body : "";
}

function LessonTypeIcon({
  type,
  className,
}: {
  type: LessonType;
  className?: string;
}) {
  const iconClass = cn("size-4 shrink-0 text-muted-foreground", className);
  switch (type) {
    case "video":
      return <Video className={iconClass} aria-hidden />;
    case "text":
      return <FileText className={iconClass} aria-hidden />;
    case "quiz":
    case "test":
      return <ListChecks className={iconClass} aria-hidden />;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function LessonMainContent({
  lesson,
  t,
}: {
  lesson: PlayerLessonPayload;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  switch (lesson.type) {
    case "video": {
      const url = readVideoUrl(lesson.content).trim();
      const embed = youtubeEmbedSrc(url);
      if (embed) {
        return (
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
            <iframe
              title={lesson.title}
              src={embed}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }
      if (url) {
        return (
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
            <video controls className="size-full" src={url} />
          </div>
        );
      }
      return (
        <p className="text-muted-foreground text-sm">
          {t("lesson_view.videoNotConfigured")}
        </p>
      );
    }
    case "text": {
      const html = readBody(lesson.content).trim();
      if (!html) {
        return (
          <p className="text-muted-foreground text-sm">
            {t("lesson_view.emptyTextLesson")}
          </p>
        );
      }
      return (
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "quiz":
    case "test":
      return null;
    default: {
      const _exhaustive: never = lesson.type;
      return _exhaustive;
    }
  }
}

export function PlayerLayout({
  courseSlug,
  courseTitle,
  activeLessonId,
  modules,
  lesson,
  blocks,
  assignmentSubmissionsByBlockId = {},
  lessonCompletion,
}: PlayerLayoutProps) {
  const { t } = useLanguage();
  const sortedMods = useMemo(() => sortModules(modules), [modules]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order_index - b.order_index),
    [blocks],
  );

  const blockTestIds = useMemo(
    () =>
      sortedBlocks
        .filter((b) => b.type === "quiz")
        .map((b) => readTestId(b.content))
        .filter((id): id is string => Boolean(id)),
    [sortedBlocks],
  );

  const defaultAccordion = useMemo(() => {
    for (const m of sortedMods) {
      if (publishedLessonsSorted(m.lessons).some((l) => l.id === activeLessonId)) {
        return m.id;
      }
    }
    return sortedMods[0]?.id ?? "";
  }, [sortedMods, activeLessonId]);

  return (
    <div className="bg-background flex min-h-screen flex-col lg:flex-row">
      <aside
        className="border-border bg-muted/15 sticky top-0 z-30 flex max-h-[40vh] flex-col border-b lg:fixed lg:left-0 lg:h-screen lg:max-h-none lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0"
        aria-label={t("lesson_view.curriculumAria")}
      >
        <div className="border-border shrink-0 space-y-3 border-b p-4">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link href={`/learn/${encodeURIComponent(courseSlug)}`}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("lesson_view.backToCourse")}
            </Link>
          </Button>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("lesson_view.courseLabel")}
            </p>
            <p className="line-clamp-3 text-sm font-semibold leading-snug">
              {courseTitle}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sortedMods.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">
              {t("lesson_view.noSyllabus")}
            </p>
          ) : (
            <Accordion
              type="single"
              collapsible
              defaultValue={defaultAccordion}
              className="w-full"
            >
              {sortedMods.map((mod) => {
                const lessons = publishedLessonsSorted(mod.lessons);
                return (
                  <AccordionItem key={mod.id} value={mod.id}>
                    <AccordionTrigger className="py-2 text-left text-sm">
                      {mod.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-1">
                      {lessons.length === 0 ? (
                        <p className="text-muted-foreground px-1 py-2 text-xs">
                          {t("lesson_view.noLessons")}
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {lessons.map((l) => {
                            const active = l.id === activeLessonId;
                            return (
                              <li key={l.id}>
                                <Link
                                  href={`/learn/${encodeURIComponent(courseSlug)}/${l.id}`}
                                  className={cn(
                                    "hover:bg-accent/80 flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                                    active &&
                                      "bg-accent text-accent-foreground ring-ring/40 font-medium ring-2",
                                  )}
                                  aria-current={active ? "page" : undefined}
                                >
                                  <LessonTypeIcon type={l.type} />
                                  <span className="min-w-0 flex-1 leading-snug">
                                    {l.title}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-72">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 lg:px-8 lg:py-10">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              {lesson.title}
            </h1>
            <p className="text-muted-foreground text-sm">{courseTitle}</p>
          </header>
          {sortedBlocks.length > 0 ? (
            <div className="flex flex-col gap-10">
              {sortedBlocks.map((block) => (
                <article
                  key={block.id}
                  className="border-border/60 scroll-mt-24 border-b pb-10 last:border-0 last:pb-0"
                >
                  <LessonBlockRenderer
                    block={block}
                    lessonTitle={lesson.title}
                    initialAssignmentSubmission={
                      block.type === "assignment"
                        ? (assignmentSubmissionsByBlockId[block.id] ?? null)
                        : null
                    }
                  />
                </article>
              ))}
            </div>
          ) : (
            <LessonMainContent lesson={lesson} t={t} />
          )}
          {lesson.test_id && !blockTestIds.includes(lesson.test_id) ? (
            <div className="space-y-4 pt-2">
              <Separator />
              <TestRevealWrapper
                testId={lesson.test_id}
                title={t("lesson_view.finalTestTitle")}
              />
            </div>
          ) : null}
          {lessonCompletion ? (
            <section className="border-border/60 space-y-3 border-t pt-8">
              <h2 className="text-lg font-semibold tracking-tight">
                {t("lesson_view.lessonProgress")}
              </h2>
              {lessonCompletion}
            </section>
          ) : null}

          <LessonNavigation
            courseSlug={courseSlug}
            modules={modules}
            currentLessonId={lesson.id}
          />
        </div>
      </main>
    </div>
  );
}
