"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FileQuestionIcon,
  FileTextIcon,
  HelpCircleIcon,
  PencilIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";

import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  reorderLesson,
  reorderModule,
  type CurriculumActionState,
} from "@/app/actions/curriculum-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

export type CurriculumLessonRow = Pick<
  Database["public"]["Tables"]["lessons"]["Row"],
  "id" | "title" | "type" | "is_published" | "order_index"
>;

export type CurriculumModuleRow = Pick<
  Database["public"]["Tables"]["modules"]["Row"],
  "id" | "title" | "order_index"
> & { lessons: CurriculumLessonRow[] };

type LessonType = Database["public"]["Enums"]["lesson_type"];

const initialCurriculumState: CurriculumActionState = {};

function LessonTypeIcon({ type, className }: { type: LessonType; className?: string }) {
  const iconClass = cn("size-4 shrink-0 text-muted-foreground", className);
  switch (type) {
    case "video":
      return <VideoIcon className={iconClass} aria-hidden />;
    case "text":
      return <FileTextIcon className={iconClass} aria-hidden />;
    case "quiz":
      return <HelpCircleIcon className={iconClass} aria-hidden />;
    case "test":
      return <FileQuestionIcon className={iconClass} aria-hidden />;
    default:
      return <FileTextIcon className={iconClass} aria-hidden />;
  }
}

function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, formAction, isPending] = useActionState(
    createModule,
    initialCurriculumState,
  );
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
    }
  }, [state.success]);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Добавить модуль</CardTitle>
      </CardHeader>
      <CardContent>
        <Form key={formKey} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="course_id" value={courseId} />
          <div className="grid min-w-0 flex-1 gap-2">
            <Label htmlFor={`new-module-title-${courseId}`}>Название модуля</Label>
            <Input
              id={`new-module-title-${courseId}`}
              name="title"
              placeholder="Например, Введение"
              required
              maxLength={200}
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending} className="shrink-0">
            {isPending ? "Создание…" : "Добавить модуль"}
          </Button>
        </Form>
        {state.error ? (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-muted-foreground mt-2 text-sm">Модуль создан.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddLessonForm({
  courseId,
  moduleId,
}: {
  courseId: string;
  moduleId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createLesson,
    initialCurriculumState,
  );
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
    }
  }, [state.success]);

  return (
    <div className="bg-muted/40 mt-3 rounded-lg border p-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        Новый урок в этом модуле
      </p>
      <Form key={formKey} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="module_id" value={moduleId} />
        <input type="hidden" name="course_id" value={courseId} />
        <div className="grid gap-2">
          <Label htmlFor={`lesson-title-${moduleId}`}>Название урока</Label>
          <Input
            id={`lesson-title-${moduleId}`}
            name="title"
            placeholder="Урок"
            required
            maxLength={200}
            disabled={isPending}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Добавление…" : "Добавить урок"}
        </Button>
        {state.error ? (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
      </Form>
    </div>
  );
}

export function CurriculumTab({
  courseId,
  courseSlug,
  modules,
}: {
  courseId: string;
  courseSlug: string;
  modules: CurriculumModuleRow[];
}) {
  const router = useRouter();
  const lessonBasePath = `/dashboard/courses/${encodeURIComponent(courseSlug)}/lessons`;
  const defaultOpen = modules.map((m) => m.id);

  async function handleDeleteModule(moduleId: string) {
    if (
      !window.confirm(
        "Удалить модуль и все уроки внутри? Это действие необратимо.",
      )
    ) {
      return;
    }
    const res = await deleteModule(moduleId);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!window.confirm("Удалить этот урок?")) {
      return;
    }
    const res = await deleteLesson(lessonId);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleReorderModule(moduleId: string, direction: "up" | "down") {
    const res = await reorderModule(courseId, moduleId, direction);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleReorderLesson(
    moduleId: string,
    lessonId: string,
    direction: "up" | "down",
  ) {
    const res = await reorderLesson(moduleId, lessonId, direction);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Программа курса</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Модули и уроки в порядке отображения. Стрелки вверх/вниз меняют порядок
          в пределах курса или модуля.
        </p>
      </div>

      {modules.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Пока нет модулей. Создайте первый модуль в форме ниже.
        </p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          className="border-border rounded-lg border px-2"
        >
          {modules.map((module, moduleIndex) => (
            <AccordionItem key={module.id} value={module.id}>
              <AccordionTrigger className="px-2 hover:no-underline">
                <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                  <span className="truncate font-medium">{module.title}</span>
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-xs font-normal tabular-nums"
                    title="Количество уроков в модуле"
                  >
                    {module.lessons.length}
                  </Badge>
                </span>
                <span
                  className="flex shrink-0 items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span
                    role="button"
                    tabIndex={moduleIndex === 0 ? -1 : 0}
                    title="Модуль выше"
                    aria-label="Модуль выше"
                    aria-disabled={moduleIndex === 0}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-xs" }),
                      moduleIndex === 0 &&
                        "pointer-events-none opacity-40",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReorderModule(module.id, "up");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleReorderModule(module.id, "up");
                      }
                    }}
                  >
                    <ChevronUpIcon className="size-3.5" aria-hidden />
                  </span>
                  <span
                    role="button"
                    tabIndex={moduleIndex === modules.length - 1 ? -1 : 0}
                    title="Модуль ниже"
                    aria-label="Модуль ниже"
                    aria-disabled={moduleIndex === modules.length - 1}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-xs" }),
                      moduleIndex === modules.length - 1 &&
                        "pointer-events-none opacity-40",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReorderModule(module.id, "down");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleReorderModule(module.id, "down");
                      }
                    }}
                  >
                    <ChevronDownIcon className="size-3.5" aria-hidden />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
                    title="Удалить модуль"
                    aria-label="Удалить модуль"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteModule(module.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDeleteModule(module.id);
                      }
                    }}
                  >
                    <Trash2Icon className="size-4" />
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-3">
                {module.lessons.length === 0 ? (
                  <p className="text-muted-foreground mb-2 text-sm">
                    В модуле пока нет уроков.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li
                        key={lesson.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border bg-card/50 px-3 py-2"
                      >
                        <LessonTypeIcon type={lesson.type} />
                        <Link
                          href={`${lessonBasePath}/${lesson.id}`}
                          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                        >
                          {lesson.title}
                        </Link>
                        {lesson.is_published ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200"
                          >
                            Опубликован
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Черновик
                          </Badge>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            className="shrink-0"
                            title="Урок выше"
                            aria-label="Урок выше"
                            disabled={lessonIndex === 0}
                            onClick={() =>
                              void handleReorderLesson(
                                module.id,
                                lesson.id,
                                "up",
                              )
                            }
                          >
                            <ChevronUpIcon className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            className="shrink-0"
                            title="Урок ниже"
                            aria-label="Урок ниже"
                            disabled={
                              lessonIndex === module.lessons.length - 1
                            }
                            onClick={() =>
                              void handleReorderLesson(
                                module.id,
                                lesson.id,
                                "down",
                              )
                            }
                          >
                            <ChevronDownIcon className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                        <Link
                          href={`${lessonBasePath}/${lesson.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "icon-xs",
                            className: "shrink-0",
                          })}
                          title="Редактировать урок"
                          aria-label="Редактировать урок"
                        >
                          <PencilIcon className="size-3.5" />
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Удалить урок"
                          aria-label="Удалить урок"
                          onClick={() => void handleDeleteLesson(lesson.id)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <AddLessonForm courseId={courseId} moduleId={module.id} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <AddModuleForm courseId={courseId} />
    </div>
  );
}
