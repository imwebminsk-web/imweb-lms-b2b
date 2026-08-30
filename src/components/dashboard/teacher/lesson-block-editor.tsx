"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  Link2Icon,
  ListChecksIcon,
  Loader2Icon,
  PenLineIcon,
  PlusIcon,
  Trash2Icon,
  TypeIcon,
  VideoIcon,
} from "lucide-react";

import {
  addBlock,
  deleteBlock,
  reorderBlock,
  updateBlock,
  updateLessonMeta,
} from "@/app/actions/lesson-block-actions";
import { createInlineTest, cloneLibraryTestToInline } from "@/app/actions/test-actions";
import type { LessonBlockType } from "@/lib/lesson-blocks/lesson-block-types";
import { LessonBlockImageUpload } from "@/components/dashboard/teacher/lesson-block-image-upload";
import { InlineTestEditor } from "@/components/dashboard/teacher/inline-test-editor";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Editor } from "@/components/ui/editor";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Database, Json } from "@/types/database.types";

type LessonType = Database["public"]["Enums"]["lesson_type"];

export type LessonEditorBlockRow = {
  id: string;
  type: LessonBlockType;
  content: Json;
  order_index: number;
};

export type LessonBlockEditorLesson = {
  id: string;
  title: string;
  type: LessonType;
  is_published: boolean;
};

function readHtml(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "<p></p>";
  }
  const c = content as Record<string, unknown>;
  if (typeof c.html === "string") return c.html;
  if (typeof c.body === "string") return c.body;
  return "<p></p>";
}

function readUrl(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.url === "string" ? c.url : "";
}

function readImageUrl(content: Json): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const c = content as Record<string, unknown>;
  const u = c.imageUrl;
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

function readInstructions(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.instructions === "string" ? c.instructions : "";
}

function readAssignmentBool(content: Json, key: "save_to_journal"): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }
  const value = (content as Record<string, unknown>)[key];
  return value === true;
}

function buildAssignmentContent(
  content: Json,
  patch: Partial<{
    instructions: string;
    save_to_journal: boolean;
  }>,
): Json {
  return {
    instructions: patch.instructions ?? readInstructions(content),
    save_to_journal:
      patch.save_to_journal ?? readAssignmentBool(content, "save_to_journal"),
  };
}

function readTestId(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.test_id === "string" ? c.test_id : "";
}

function blockTypeLabel(t: LessonBlockType): string {
  switch (t) {
    case "text":
      return "Текст (с форматированием)";
    case "image":
      return "Изображение";
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "assignment":
      return "Задание";
    case "quiz":
      return "Тест / квиз";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

function BlockTypeIcon({ type }: { type: LessonBlockType }) {
  switch (type) {
    case "text":
      return <TypeIcon className="size-4" aria-hidden />;
    case "image":
      return <ImageIcon className="size-4" aria-hidden />;
    case "youtube":
    case "vimeo":
      return <VideoIcon className="size-4" aria-hidden />;
    case "assignment":
      return <PenLineIcon className="size-4" aria-hidden />;
    case "quiz":
      return <ListChecksIcon className="size-4" aria-hidden />;
    default: {
      const _e: never = type;
      return _e;
    }
  }
}

function TextBlockEditor({
  blockId,
  content,
}: {
  blockId: string;
  content: Json;
}) {
  const router = useRouter();
  const serverHtml = readHtml(content);
  const [html, setHtml] = useState(() => serverHtml);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHtml(serverHtml);
  }, [blockId, serverHtml]);

  async function save() {
    setSaving(true);
    const res = await updateBlock(blockId, { html });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Текст сохранён");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Editor value={html} onChange={setHtml} />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Сохранение…" : "Сохранить текст"}
      </Button>
    </div>
  );
}

export function LessonBlockEditor({
  courseSlug,
  courseTitle,
  lesson,
  blocks,
  tests,
}: {
  courseSlug: string;
  courseTitle: string;
  lesson: LessonBlockEditorLesson;
  blocks: LessonEditorBlockRow[];
  tests: { id: string; title: string; folder_name?: string | null }[];
}) {
  const router = useRouter();
  const sorted = useMemo(
    () => [...blocks].sort((a, b) => a.order_index - b.order_index),
    [blocks],
  );
  const groupedTests = useMemo(() => {
    const grouped = tests.reduce(
      (acc, test) => {
        const normalized = test.folder_name?.trim();
        const folder = normalized && normalized.length > 0 ? normalized : "Без папки";
        const bucket = acc.get(folder) ?? [];
        bucket.push(test);
        acc.set(folder, bucket);
        return acc;
      },
      new Map<string, typeof tests>(),
    );

    const entries = [...grouped.entries()].sort(([a], [b]) => {
      if (a === "Без папки") return -1;
      if (b === "Без папки") return 1;
      return a.localeCompare(b, "ru");
    });

    return entries.map(([folderName, folderTests]) => ({
      folderName,
      tests: [...folderTests].sort((a, b) => a.title.localeCompare(b.title, "ru")),
    }));
  }, [tests]);

  const [title, setTitle] = useState(lesson.title);
  const [isPublished, setIsPublished] = useState(lesson.is_published);
  const [isMetaPending, startMetaTransition] = useTransition();
  const [adding, setAdding] = useState<LessonBlockType | null>(null);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [detachQuizBlockId, setDetachQuizBlockId] = useState<string | null>(
    null,
  );
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isDetachPending, startDetachTransition] = useTransition();
  const [cloningBlockId, setCloningBlockId] = useState<string | null>(null);
  const [isClonePending, startCloneTransition] = useTransition();

  useEffect(() => {
    setTitle(lesson.title);
    setIsPublished(lesson.is_published);
  }, [lesson.id, lesson.title, lesson.is_published]);

  const courseHref = `/dashboard/courses/${encodeURIComponent(courseSlug)}`;

  function handleSaveMeta(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startMetaTransition(async () => {
      const result = await updateLessonMeta(lesson.id, {
        title,
        is_published: isPublished,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Название и статус сохранены");
      router.refresh();
    });
  }

  async function handleAdd(type: LessonBlockType) {
    setAdding(type);
    const res = await addBlock(lesson.id, type);
    setAdding(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Блок добавлен");
    router.refresh();
  }

  function handlePickLibraryTest(blockId: string, libraryTestId: string) {
    if (isClonePending) {
      return;
    }

    setCloningBlockId(blockId);
    startCloneTransition(async () => {
      const cloneRes = await cloneLibraryTestToInline(libraryTestId, blockId);
      if (!cloneRes.ok) {
        toast.error(cloneRes.error);
        setCloningBlockId(null);
        return;
      }

      const updateRes = await updateBlock(blockId, { test_id: cloneRes.testId });
      setCloningBlockId(null);
      if (!updateRes.ok) {
        toast.error(updateRes.error);
        return;
      }
      toast.success("Тест скопирован в урок");
      router.refresh();
    });
  }

  async function handleCreateInlineTest() {
    setAdding("quiz");
    const blockRes = await addBlock(lesson.id, "quiz");
    if (!blockRes.ok) {
      setAdding(null);
      toast.error(blockRes.error);
      return;
    }

    const testRes = await createInlineTest(blockRes.blockId, "Встроенный тест");
    if (!testRes.ok) {
      setAdding(null);
      toast.error(testRes.error);
      return;
    }

    const updateRes = await updateBlock(blockRes.blockId, { test_id: testRes.testId });
    setAdding(null);

    if (!updateRes.ok) {
      toast.error(updateRes.error);
      return;
    }

    toast.success("Встроенный тест создан");
    router.refresh();
  }

  function handleDeleteBlockConfirm() {
    if (!deleteBlockId) return;
    startDeleteTransition(async () => {
      const res = await deleteBlock(deleteBlockId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Блок удалён");
      setDeleteBlockId(null);
      router.refresh();
    });
  }

  async function handleReorderBlock(
    blockId: string,
    direction: "up" | "down",
  ) {
    const res = await reorderBlock(lesson.id, blockId, direction);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  function handleDetachQuizConfirm() {
    if (!detachQuizBlockId) return;
    startDetachTransition(async () => {
      const res = await updateBlock(detachQuizBlockId, { test_id: "" });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Тест убран из блока");
      setDetachQuizBlockId(null);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 lg:px-6">
      <div className="flex flex-col gap-2">
        <Button variant="link" size="sm" asChild>
          <Link href={courseHref}>← К курсу: {courseTitle}</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Редактор урока
        </h1>
        <p className="text-muted-foreground text-sm">
          Блоки контента в одном уроке (как в Notion). Ниже сохраняйте название и
          публикацию; текстовые блоки — кнопкой «Сохранить текст».
        </p>
      </div>

      <Form
        onSubmit={handleSaveMeta}
        className="border-border bg-card space-y-4 rounded-xl border p-6 shadow-sm"
      >
        <div className="grid gap-2">
          <Label htmlFor="lesson-title-meta">Название урока</Label>
          <Input
            id="lesson-title-meta"
            name="title"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isMetaPending}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="lesson-published-meta"
            checked={isPublished}
            onCheckedChange={(v) => setIsPublished(v === true)}
            disabled={isMetaPending}
          />
          <Label htmlFor="lesson-published-meta" className="font-normal">
            Опубликован (виден при опубликованном курсе)
          </Label>
        </div>
        <Button type="submit" disabled={isMetaPending}>
          {isMetaPending ? "Сохранение…" : "Сохранить название и статус"}
        </Button>
      </Form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight">Блоки урока</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {adding ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              Добавить блок
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(
              [
                "text",
                "image",
                "youtube",
                "vimeo",
                "assignment",
              ] as const
            ).map((t) => (
              <DropdownMenuItem
                key={t}
                disabled={adding !== null}
                onSelect={() => void handleAdd(t)}
              >
                <span className="flex items-center gap-2">
                  <BlockTypeIcon type={t} />
                  {blockTypeLabel(t)}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={adding !== null}
              onSelect={() => void handleAdd("quiz")}
            >
              <span className="flex items-center gap-2">
                <ListChecksIcon className="size-4" aria-hidden />
                Тест из библиотеки
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={adding !== null}
              onSelect={() => void handleCreateInlineTest()}
            >
              <span className="flex items-center gap-2">
                <PlusIcon className="size-4" aria-hidden />
                Новый тест (встроенный)
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-4">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Нет блоков. Добавьте первый блок кнопкой выше.
          </p>
        ) : (
          sorted.map((block, idx) => (
            <Card key={block.id} className="overflow-hidden shadow-sm">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b py-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <BlockTypeIcon type={block.type} />
                  {blockTypeLabel(block.type)}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    title="Блок выше"
                    aria-label="Блок выше"
                    disabled={idx === 0}
                    onClick={() => void handleReorderBlock(block.id, "up")}
                  >
                    <ChevronUpIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    title="Блок ниже"
                    aria-label="Блок ниже"
                    disabled={idx === sorted.length - 1}
                    onClick={() => void handleReorderBlock(block.id, "down")}
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-xs"
                    title="Удалить блок"
                    aria-label="Удалить блок"
                    onClick={() => setDeleteBlockId(block.id)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {block.type === "text" ? (
                  <TextBlockEditor blockId={block.id} content={block.content} />
                ) : null}
                {block.type === "image" ? (
                  <LessonBlockImageUpload
                    lessonId={lesson.id}
                    blockId={block.id}
                    imageUrl={readImageUrl(block.content)}
                  />
                ) : null}
                {block.type === "youtube" || block.type === "vimeo" ? (
                  <div className="grid gap-2">
                    <Label htmlFor={`url-${block.id}`}>
                      {block.type === "youtube"
                        ? "Ссылка на видео (YouTube)"
                        : "Ссылка на видео (Vimeo)"}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`url-${block.id}`}
                        type="url"
                        defaultValue={readUrl(block.content)}
                        placeholder="https://…"
                        className="font-mono text-sm"
                        onBlur={async (e) => {
                          const url = e.target.value.trim();
                          const res = await updateBlock(block.id, { url });
                          if (!res.ok) toast.error(res.error);
                          else router.refresh();
                        }}
                      />
                      <Link2Icon
                        className="text-muted-foreground size-5 shrink-0 self-center"
                        aria-hidden
                      />
                    </div>
                  </div>
                ) : null}
                {block.type === "assignment" ? (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`instr-${block.id}`}>Инструкция</Label>
                      <Textarea
                        id={`instr-${block.id}`}
                        rows={6}
                        defaultValue={readInstructions(block.content)}
                        placeholder="Опишите задание для ученика…"
                        onBlur={async (e) => {
                          const instructions = e.target.value;
                          const res = await updateBlock(
                            block.id,
                            buildAssignmentContent(block.content, { instructions }),
                          );
                          if (!res.ok) toast.error(res.error);
                          else router.refresh();
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor={`save-journal-${block.id}`}>
                          Записывать в журнал
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          Результат попадёт в журнал оценок.
                        </p>
                      </div>
                      <Switch
                        id={`save-journal-${block.id}`}
                        checked={readAssignmentBool(block.content, "save_to_journal")}
                        onCheckedChange={async (checked) => {
                          const res = await updateBlock(
                            block.id,
                            buildAssignmentContent(block.content, {
                              save_to_journal: checked,
                            }),
                          );
                          if (!res.ok) toast.error(res.error);
                          else router.refresh();
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                {block.type === "quiz" ? (() => {
                  const testId = readTestId(block.content);
                  const isLibraryTest = testId ? tests.some((t) => t.id === testId) : false;

                  if (!testId) {
                    return (
                      <div className="grid gap-2">
                        <Label>Тест из библиотеки</Label>
                        {tests.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Создайте тест в разделе «Тесты».
                          </p>
                        ) : (
                          <Select
                            value={undefined}
                            disabled={isClonePending}
                            onValueChange={(libraryTestId) =>
                              handlePickLibraryTest(block.id, libraryTestId)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  cloningBlockId === block.id
                                    ? "Копирование теста…"
                                    : "Выберите тест…"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {groupedTests.map((group) => (
                                <SelectGroup key={group.folderName}>
                                  <SelectLabel>
                                    {group.folderName} ({group.tests.length})
                                  </SelectLabel>
                                  {group.tests.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.title}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  }

                  if (isLibraryTest) {
                    const testTitle = tests.find((t) => t.id === testId)?.title;
                    return (
                      <div className="grid gap-2 rounded-lg border p-4">
                        <Label>Выбран тест из библиотеки</Label>
                        <p className="text-sm font-medium">{testTitle}</p>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="mt-2 w-fit"
                          onClick={() => setDetachQuizBlockId(block.id)}
                        >
                          Убрать тест
                        </Button>
                      </div>
                    );
                  }

                  return <InlineTestEditor testId={testId} />;
                })() : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog
        open={deleteBlockId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteBlockId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блок?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены? Это действие навсегда удалит этот блок. Отменить
              невозможно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlockConfirm}
              disabled={isDeletePending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isDeletePending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={detachQuizBlockId !== null}
        onOpenChange={(open) => {
          if (!open) setDetachQuizBlockId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Убрать тест из блока?</AlertDialogTitle>
            <AlertDialogDescription>
              Тест отвяжется от урока. Сам тест в библиотеке останется.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDetachPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetachQuizConfirm}
              disabled={isDetachPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isDetachPending ? "Удаление…" : "Убрать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
