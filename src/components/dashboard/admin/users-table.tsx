"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteUser, updateUserRole } from "@/app/actions/admin-actions";
import type { AdminUserRow } from "@/app/dashboard/fetch-dashboard-data";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

type UsersTableProps = {
  users: AdminUserRow[];
  currentUserId: string;
};

const ROLE_LABELS: Record<ProfileRole, string> = {
  student: "Студент",
  teacher: "Преподаватель",
  admin: "Администратор",
};

function formatRegisteredAt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayName(user: AdminUserRow): string {
  return (
    user.fullName?.trim() ||
    user.email?.split("@")[0] ||
    user.id.slice(0, 8)
  );
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  function handleRoleChange(userId: string, role: ProfileRole) {
    startTransition(async () => {
      const result = await updateUserRole(userId, role);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Роль обновлена");
      router.refresh();
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    const targetId = deleteTarget.id;
    startTransition(async () => {
      const result = await deleteUser(targetId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Пользователь удалён");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Управление пользователями
          </h2>
          <p className="text-muted-foreground text-sm">
            Изменение ролей и удаление аккаунтов
          </p>
        </div>
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table className="min-w-[36rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Дата регистрации</TableHead>
                <TableHead className="w-12 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Пользователи не найдены.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{displayName(user)}</span>
                          {user.email ? (
                            <span className="text-muted-foreground text-xs">
                              {user.email}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatRegisteredAt(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={isPending}
                              aria-label="Действия с пользователем"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isSelf ? (
                              <DropdownMenuItem disabled>
                                Нельзя изменить свой аккаунт
                              </DropdownMenuItem>
                            ) : (
                              <>
                                {user.role !== "teacher" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "teacher")
                                    }
                                  >
                                    Сделать Учителем
                                  </DropdownMenuItem>
                                )}
                                {user.role !== "student" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "student")
                                    }
                                  >
                                    Сделать Студентом
                                  </DropdownMenuItem>
                                )}
                                {user.role !== "admin" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "admin")
                                    }
                                  >
                                    Сделать Админом
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(user)}
                                >
                                  Удалить пользователя
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Аккаунт «${displayName(deleteTarget)}» и все связанные данные будут удалены без возможности восстановления.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {isPending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
