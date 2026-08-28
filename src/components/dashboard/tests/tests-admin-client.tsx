"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import {
  hardDeleteTest,
  type TestListItemEnriched,
} from "@/app/actions/test-actions";
import { TestRowActions } from "@/components/admin/tests/TestRowActions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type TestsAdminClientProps = {
  tests: TestListItemEnriched[];
  error?: string;
  isArchived?: boolean;
  canHardDelete?: boolean;
  canChangeOwner?: boolean;
};

function folderLabel(folderName: string | null | undefined): string {
  const normalized = folderName?.trim();
  return normalized && normalized.length > 0 ? normalized : "Без папки";
}

function authorDisplayName(test: TestListItemEnriched): string {
  return (
    test.author?.fullName?.trim() ||
    test.author?.email?.split("@")[0] ||
    "—"
  );
}

function groupTestsByFolder(tests: TestListItemEnriched[]) {
  const map = new Map<string, TestListItemEnriched[]>();
  for (const test of tests) {
    const folder = folderLabel(test.folder_name);
    const bucket = map.get(folder) ?? [];
    bucket.push(test);
    map.set(folder, bucket);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ru"));
}

function AuthorCell({ test }: { test: TestListItemEnriched }) {
  const name = authorDisplayName(test);

  return (
    <div className="flex min-w-[10rem] items-center gap-3">
      <Avatar className="size-9 shrink-0">
        <AvatarImage
          src={test.author?.avatarUrl ?? undefined}
          alt={name}
        />
        <AvatarFallback className="text-xs">
          {initialsFromDisplayName(name === "—" ? "?" : name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-foreground">{name}</span>
        {test.author?.email ? (
          <span className="truncate text-sm text-muted-foreground">
            {test.author.email}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TestsAdminClient({
  tests,
  error,
  isArchived = false,
  canHardDelete = false,
  canChangeOwner = false,
}: TestsAdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testToHardDelete, setTestToHardDelete] =
    useState<TestListItemEnriched | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(),
  );

  function openHardDeleteDialog(test: TestListItemEnriched) {
    setTestToHardDelete(test);
    setDeleteConfirmText("");
  }

  function closeHardDeleteDialog() {
    setTestToHardDelete(null);
    setDeleteConfirmText("");
  }

  function handleHardDeleteConfirm() {
    if (!testToHardDelete) {
      return;
    }

    const targetId = testToHardDelete.id;
    startTransition(async () => {
      const result = await hardDeleteTest(targetId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Тест удалён навсегда");
      closeHardDeleteDialog();
      router.refresh();
    });
  }

  function handleChangeOwnerRequest() {
    toast.info("Выбор нового автора появится в следующем шаге.");
  }

  function toggleFolder(folderName: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  }

  const uniqueFolders = useMemo(() => {
    const folders = new Set(tests.map((test) => folderLabel(test.folder_name)));
    return [...folders].sort((a, b) => a.localeCompare(b, "ru"));
  }, [tests]);

  const filteredTests = useMemo(() => {
    let result = tests;
    const normalized = searchQuery.trim().toLowerCase();

    if (normalized) {
      result = result.filter((test) => {
        const authorName = test.author?.fullName?.toLowerCase() ?? "";
        const authorEmail = test.author?.email?.toLowerCase() ?? "";
        return (
          test.title.toLowerCase().includes(normalized) ||
          authorName.includes(normalized) ||
          authorEmail.includes(normalized)
        );
      });
    }

    if (folderFilter !== "all") {
      result = result.filter(
        (test) => folderLabel(test.folder_name) === folderFilter,
      );
    }

    return result;
  }, [tests, searchQuery, folderFilter]);

  const folderGroups = useMemo(
    () => groupTestsByFolder(filteredTests),
    [filteredTests],
  );

  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const [folderName] of folderGroups) {
        next.add(folderName);
      }
      return next;
    });
  }, [folderGroups]);

  if (error) {
    return (
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-destructive/40 bg-destructive/5 px-6 py-8">
          <p className="font-medium">Не удалось загрузить список</p>
          <p className="text-destructive mt-1 text-sm">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 border-b px-6 py-4">
          {!isArchived ? (
            <div className="flex justify-end">
              <Link
                href="/dashboard/tests/create"
                className={buttonVariants({ size: "default" })}
              >
                Создать тест
              </Link>
            </div>
          ) : null}
          <div className="flex flex-col items-center justify-end gap-4 sm:flex-row">
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Все папки" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все папки</SelectItem>
                {uniqueFolders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="search"
              placeholder="Поиск по названию, автору или email…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full max-w-sm"
              aria-label="Поиск тестов"
            />
          </div>
        </div>

        <div className="custom-scrollbar w-full overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Автор</TableHead>
                <TableHead className="w-12 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folderGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {searchQuery.trim() || folderFilter !== "all"
                      ? "Нет тестов по выбранным фильтрам."
                      : isArchived
                        ? "В архиве пока нет тестов."
                        : "Пока нет тестов. Создайте первый тест в библиотеке."}
                  </TableCell>
                </TableRow>
              ) : (
                folderGroups.map(([folderName, folderTests]) => {
                  const isExpanded = expandedFolders.has(folderName);

                  return (
                    <Fragment key={folderName}>
                      <TableRow className="bg-muted/40 hover:bg-muted/50">
                        <TableCell colSpan={3} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleFolder(folderName)}
                            className="flex w-full items-center gap-2 px-6 py-3 text-left font-medium"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                            <span>{folderName}</span>
                            <Badge variant="secondary" className="tabular-nums">
                              {folderTests.length}
                            </Badge>
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded
                        ? folderTests.map((test) => (
                            <TableRow key={test.id}>
                              <TableCell>
                                <div className="min-w-[12rem] max-w-md pl-6">
                                  <p className="font-medium leading-snug">
                                    {test.title}
                                  </p>
                                  {test.description ? (
                                    <p className="text-muted-foreground line-clamp-1 text-sm">
                                      {test.description}
                                    </p>
                                  ) : null}
                                  <Badge
                                    variant="secondary"
                                    className="mt-1 tabular-nums"
                                  >
                                    Вопросов: {test.totalQuestions}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <AuthorCell test={test} />
                              </TableCell>
                              <TableCell className="text-right">
                                <TestRowActions
                                  testId={test.id}
                                  isArchived={test.is_archived}
                                  canHardDelete={canHardDelete}
                                  canChangeOwner={canChangeOwner}
                                  onHardDeleteRequest={() =>
                                    openHardDeleteDialog(test)
                                  }
                                  onChangeOwnerRequest={handleChangeOwnerRequest}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <AlertDialog
        open={testToHardDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            closeHardDeleteDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тест навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              {testToHardDelete
                ? `Вы собираетесь безвозвратно удалить «${testToHardDelete.title}». Это действие необратимо.`
                : "Это действие необратимо."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">
              Введите слово{" "}
              <span className="font-bold text-foreground">Удалить</span> для
              подтверждения:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              autoComplete="off"
              aria-label="Подтверждение удаления теста"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive-outline"
              disabled={
                isPending ||
                deleteConfirmText.trim().toLowerCase() !== "удалить"
              }
              onClick={handleHardDeleteConfirm}
            >
              {isPending ? "Удаление…" : "Удалить навсегда"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
