"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Accordion as AccordionPrimitive } from "radix-ui";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  FileQuestionIcon,
  FileTextIcon,
  HelpCircleIcon,
  PencilIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  reorderLesson,
  reorderModule,
  updateModule,
  type CurriculumActionState,
} from "@/app/actions/curriculum-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
          <Button type="submit" disabled={isPending}>
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
        <Button type="submit" size="sm" disabled={isPending}>
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

  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [isEditPending, startEditTransition] = useTransition();

  function handleDeleteModuleConfirm() {
    if (!deleteModuleId) return;
    startDeleteTransition(async () => {
      const res = await deleteModule(deleteModuleId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Модуль удалён");
      setDeleteModuleId(null);
      router.refresh();
    });
  }

  function handleDeleteLessonConfirm() {
    if (!deleteLessonId) return;
    startDeleteTransition(async () => {
      const res = await deleteLesson(deleteLessonId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Урок удалён");
      setDeleteLessonId(null);
      router.refresh();
    });
  }

  function handleSaveModuleTitle(moduleId: string) {
    if (!editModuleTitle.trim()) {
      toast.error("Название модуля не может быть пустым");
      return;
    }
    startEditTransition(async () => {
      const res = await updateModule(moduleId, editModuleTitle);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Название модуля сохранено");
      setEditingModuleId(null);
      setEditModuleTitle("");
      router.refresh();
    });
  }

  async function handleReorderModule(moduleId: string, direction: "up" | "down") {
    const res = await reorderModule(courseId, moduleId, direction);
    if (res.error) {
      toast.error(res.error);
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
      toast.error(res.error);
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
            <AccordionItem key={module.id} value={module.id} className="group">
              {editingModuleId === module.id ? (
                <div className="flex items-center gap-2 p-4">
                  <Input
                    value={editModuleTitle}
                    onChange={(e) => setEditModuleTitle(e.target.value)}
                    className="h-8 min-w-0 flex-1"
                    disabled={isEditPending}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveModuleTitle(module.id);
                      } else if (e.key === "Escape") {
                        setEditingModuleId(null);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isEditPending}
                    onClick={() => handleSaveModuleTitle(module.id)}
                  >
                    <CheckIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isEditPending}
                    onClick={() => setEditingModuleId(null)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex w-full flex-wrap items-center gap-2 pr-4">
                  <AccordionPrimitive.Trigger className="min-w-0 flex-1 text-left text-sm font-medium hover:underline truncate py-2">
                    {module.title}
                  </AccordionPrimitive.Trigger>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="shrink-0"
                        title="Модуль выше"
                        aria-label="Модуль выше"
                        disabled={moduleIndex === 0}
                        onClick={() => void handleReorderModule(module.id, "up")}
                      >
                        <ArrowUpIcon className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="shrink-0"
                        title="Модуль ниже"
                        aria-label="Модуль ниже"
                        disabled={moduleIndex === modules.length - 1}
                        onClick={() =>
                          void handleReorderModule(module.id, "down")
                        }
                      >
                        <ArrowDownIcon className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      title="Редактировать название"
                      aria-label="Редактировать название"
                      onClick={() => {
                        setEditModuleTitle(module.title);
                        setEditingModuleId(module.id);
                      }}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      title="Удалить модуль"
                      aria-label="Удалить модуль"
                      onClick={() => setDeleteModuleId(module.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                    <AccordionPrimitive.Trigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0"
                        aria-label="Развернуть или свернуть модуль"
                      >
                        <ChevronDownIcon className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </Button>
                    </AccordionPrimitive.Trigger>
                  </div>
                </div>
              )}
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
                            <ArrowUpIcon className="size-3.5" aria-hidden />
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
                            <ArrowDownIcon className="size-3.5" aria-hidden />
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
                          className="shrink-0"
                          title="Удалить урок"
                          aria-label="Удалить урок"
                          onClick={() => setDeleteLessonId(lesson.id)}
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

      <AlertDialog
        open={deleteModuleId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteModuleId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить модуль?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены? Это действие удалит модуль и все уроки внутри него. Это нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModuleConfirm}
              disabled={isDeletePending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isDeletePending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteLessonId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLessonId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить урок?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены? Это действие удалит урок и весь его контент. Это нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLessonConfirm}
              disabled={isDeletePending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isDeletePending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
