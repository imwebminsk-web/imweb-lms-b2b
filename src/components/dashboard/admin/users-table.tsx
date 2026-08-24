"use client";

import { Key, MoreHorizontal, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deactivateUser,
  deleteUser,
  resetUserPassword,
  updateUserRole,
} from "@/app/actions/admin-actions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  head_teacher: "Руководитель",
};

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";

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

function generateRandomPassword(length = 10): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += PASSWORD_CHARS[array[i]! % PASSWORD_CHARS.length]!;
  }
  return result;
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [resetPasswordUser, setResetPasswordUser] =
    useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

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

  function handleDeactivate(userId: string) {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const result = await deactivateUser(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Сотрудник уволен. Курсы остаются активными — смените владельца при необходимости.");
      router.refresh();
    });
  }

  function openResetPasswordDialog(user: AdminUserRow) {
    setResetPasswordUser(user);
    setNewPassword("");
  }

  function closeResetPasswordDialog() {
    setResetPasswordUser(null);
    setNewPassword("");
  }

  function handleGeneratePassword() {
    setNewPassword(generateRandomPassword(10));
  }

  async function handleCopyPassword() {
    if (!newPassword.trim()) {
      toast.error("Нечего копировать — сначала введите или сгенерируйте пароль.");
      return;
    }
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Пароль скопирован");
    } catch {
      toast.error("Не удалось скопировать пароль");
    }
  }

  function handleResetPasswordSave() {
    if (!resetPasswordUser) {
      return;
    }
    if (!newPassword.trim()) {
      toast.error("Введите новый пароль");
      return;
    }

    const targetId = resetPasswordUser.id;
    const password = newPassword.trim();

    startTransition(async () => {
      const result = await resetUserPassword(targetId, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Пароль обновлён");
      closeResetPasswordDialog();
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
            Изменение ролей, сброс паролей и удаление аккаунтов
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
                  const isActive = user.isActive !== false;
                  return (
                    <TableRow
                      key={user.id}
                      className={isActive ? undefined : "opacity-60"}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2 font-medium">
                            {displayName(user)}
                            {!isActive ? (
                              <Badge variant="outline" className="text-[10px]">
                                Уволен
                              </Badge>
                            ) : null}
                          </span>
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
                                {user.role !== "head_teacher" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "head_teacher")
                                    }
                                  >
                                    Сделать Руководителем
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => openResetPasswordDialog(user)}
                                >
                                  <Key className="mr-2 size-4" aria-hidden />
                                  Сбросить пароль
                                </DropdownMenuItem>
                                {isActive ? (
                                  <DropdownMenuItem
                                    onClick={() => handleDeactivate(user.id)}
                                  >
                                    <UserX className="mr-2 size-4" aria-hidden />
                                    Деактивировать / Уволить
                                  </DropdownMenuItem>
                                ) : null}
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

      <Dialog
        open={resetPasswordUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeResetPasswordDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resetPasswordUser
                ? `Сброс пароля для ${displayName(resetPasswordUser)}`
                : "Сброс пароля"}
            </DialogTitle>
            {resetPasswordUser?.email ? (
              <DialogDescription>{resetPasswordUser.email}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-new-password">Новый пароль</Label>
              <Input
                id="admin-new-password"
                type="text"
                autoComplete="off"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isPending}
                placeholder="Минимум 6 символов"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                disabled={isPending}
              >
                Сгенерировать
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyPassword()}
                disabled={isPending || !newPassword.trim()}
              >
                Скопировать
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeResetPasswordDialog}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleResetPasswordSave}
              disabled={isPending || !newPassword.trim()}
            >
              {isPending ? "Сохранение…" : "Сохранить новый пароль"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
