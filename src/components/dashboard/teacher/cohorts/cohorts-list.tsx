"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  CheckIcon,
  CopyIcon,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { StaffCohortListItem } from "@/app/actions/cohort-actions";
import {
  archiveCohort,
  hardDeleteCohort,
  restoreCohort,
} from "@/app/actions/cohort-actions";
import { CohortStatusBadge } from "@/components/dashboard/cohorts/cohort-status-badge";
import { CohortStatusLegend } from "@/components/dashboard/cohorts/cohort-status-legend";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { pendingReviewBadgeClassName } from "@/lib/dashboard/pending-review-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function courseMeta(rel: StaffCohortListItem["courses"]) {
  if (rel == null) {
    return { title: "—", isArchived: false };
  }
  const row = Array.isArray(rel) ? rel[0] : rel;
  return {
    title: row?.title?.trim() || "—",
    isArchived: row?.is_archived === true,
  };
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function CohortsList({
  cohorts,
  mode,
  unreadMap = {},
  pendingMap = {},
}: {
  cohorts: StaffCohortListItem[];
  mode: "active" | "archived";
  unreadMap?: Record<string, number>;
  pendingMap?: Record<string, number>;
}) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cohortToArchive, setCohortToArchive] = useState<string | null>(null);
  const [cohortToRestore, setCohortToRestore] = useState<string | null>(null);
  const [cohortToHardDelete, setCohortToHardDelete] = useState<string | null>(
    null,
  );
  const [archiveConfirmText, setArchiveConfirmText] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  async function copyPin(
    event: React.MouseEvent,
    pin: string,
    id: string,
  ) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedId(id);
      toast.success("PIN скопирован");
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2000);
    } catch {
      toast.error("Не удалось скопировать PIN");
    }
  }

  function handleArchiveConfirm() {
    if (!cohortToArchive || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await archiveCohort(cohortToArchive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Группа перенесена в архив");
      setCohortToArchive(null);
      setArchiveConfirmText("");
      router.refresh();
    });
  }

  function handleRestoreConfirm() {
    if (!cohortToRestore || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await restoreCohort(cohortToRestore);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Группа восстановлена");
      setCohortToRestore(null);
      router.refresh();
    });
  }

  function handleHardDeleteConfirm() {
    if (!cohortToHardDelete || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await hardDeleteCohort(cohortToHardDelete);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Группа удалена навсегда");
      setCohortToHardDelete(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  }

  if (cohorts.length === 0) {
    return (
      <>
        <div className="flex justify-end border-b px-6 py-3">
          <CohortStatusLegend />
        </div>
        <p className="text-muted-foreground px-6 py-12 text-center text-sm">
          {mode === "archived"
            ? "В архиве нет групп."
            : "Пока нет групп. Создайте первую кнопкой «Создать группу»."}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end border-b px-6 py-3">
        <CohortStatusLegend />
      </div>
      <div className="custom-scrollbar w-full overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead>Группа</TableHead>
              <TableHead>Курс</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Создана</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.map((row) => {
              const unreadCount = unreadMap[row.id] ?? 0;
              const pendingCount = pendingMap[row.id] ?? 0;
              const { title: courseTitle, isArchived: courseArchived } =
                courseMeta(row.courses);

              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/cohorts/${row.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.name}</span>
                      {pendingCount > 0 ? (
                        <Badge className={pendingReviewBadgeClassName}>
                          {pendingCount}
                        </Badge>
                      ) : null}
                      {unreadCount > 0 ? (
                        <Badge
                          variant="destructive"
                          className="min-w-5 justify-center px-1.5 tabular-nums"
                        >
                          {unreadCount}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {courseTitle}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-mono text-sm tracking-widest"
                      >
                        {row.pin_code}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Скопировать PIN"
                        onClick={(event) =>
                          void copyPin(event, row.pin_code, row.id)
                        }
                      >
                        {copiedId === row.id ? (
                          <CheckIcon className="size-4" aria-hidden />
                        ) : (
                          <CopyIcon className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CohortStatusBadge
                      cohortIsArchived={row.is_archived}
                      courseIsArchived={courseArchived}
                      cohortIsActive={row.is_active}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {formatCreatedAt(row.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Действия с группой"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/cohorts/${row.id}`}
                            className="flex items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Открыть
                          </Link>
                        </DropdownMenuItem>
                        {mode === "active" ? (
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation();
                              setCohortToArchive(row.id);
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            В архив
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                setCohortToRestore(row.id);
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Восстановить
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCohortToHardDelete(row.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Удалить навсегда
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={cohortToArchive !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCohortToArchive(null);
            setArchiveConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перенести группу в архив?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь перенести группу в архив. Введите слово{" "}
              <span className="font-bold text-foreground">Архивировать</span>{" "}
              для подтверждения:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={archiveConfirmText}
            onChange={(event) => setArchiveConfirmText(event.target.value)}
            autoComplete="off"
            aria-label="Подтверждение архивирования группы"
          />
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
                isPending || archiveConfirmText.trim() !== "Архивировать"
              }
              onClick={handleArchiveConfirm}
            >
              {isPending ? "Архивирование…" : "В архив"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cohortToRestore !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCohortToRestore(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить группу?</AlertDialogTitle>
            <AlertDialogDescription>
              Группа снова появится во вкладке «Открытые».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleRestoreConfirm}
            >
              {isPending ? "Восстановление…" : "Восстановить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cohortToHardDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCohortToHardDelete(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить группу навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь удалить группу навсегда. Это необратимо удалит
              уроки, тесты и прогресс учеников. Введите слово{" "}
              <span className="font-bold text-foreground">Удалить</span> для
              подтверждения:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            autoComplete="off"
            aria-label="Подтверждение удаления группы"
          />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive-outline"
              disabled={isPending || deleteConfirmText.trim() !== "Удалить"}
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
