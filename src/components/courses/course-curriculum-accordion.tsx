"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import { FileText, ListChecks, Video } from "lucide-react";

export type CurriculumLessonPreview = {
  id: string;
  title: string;
  type: Database["public"]["Enums"]["lesson_type"];
};

export type CurriculumModulePreview = {
  id: string;
  title: string;
  lessons: CurriculumLessonPreview[];
};

function LessonTypeIcon({
  type,
  className,
}: {
  type: CurriculumLessonPreview["type"];
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

function lessonTypeLabel(type: CurriculumLessonPreview["type"]): string {
  switch (type) {
    case "video":
      return "Видео";
    case "text":
      return "Текст";
    case "quiz":
      return "Квиз";
    case "test":
      return "Тест";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function CourseCurriculumAccordion({
  modules,
  className,
}: {
  modules: CurriculumModulePreview[];
  className?: string;
}) {
  if (modules.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Программа курса пока не добавлена.
      </p>
    );
  }

  const defaultOpen = modules[0]?.id;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen}
      className={cn("w-full", className)}
    >
      {modules.map((mod) => (
        <AccordionItem key={mod.id} value={mod.id}>
          <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
            {mod.title}
          </AccordionTrigger>
          <AccordionContent>
            {mod.lessons.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">
                Нет опубликованных уроков в этом модуле.
              </p>
            ) : (
              <ul className="space-y-2 py-1">
                {mod.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className="flex items-start gap-2 rounded-md border border-transparent px-1 py-1.5 text-sm"
                  >
                    <LessonTypeIcon type={lesson.type} />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="sr-only">
                        {lessonTypeLabel(lesson.type)}:{" "}
                      </span>
                      {lesson.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
