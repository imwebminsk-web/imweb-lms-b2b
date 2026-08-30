"use client";

import { Crown, GraduationCap, Key, MoreHorizontal, Shield, Trash2, User, UserCheck, UserX, ArrowUpDown, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";

import {
  activateUser,
  deactivateUser,
  deleteUser,
  resetUserPassword,
  updateUserRole,
} from "@/app/actions/admin-actions";
import type { AdminUserRow } from "@/app/dashboard/fetch-dashboard-data";
import { CreateUserDialog } from "@/components/dashboard/admin/users/create-user-dialog";
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
import { initialsFromDisplayName } from "@/lib/utils/user-utils";
import { getRoleTranslation } from "@/lib/utils/role-utils";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];
type UserDangerAction = "delete" | "deactivate";

type UsersTableProps = {
  users: AdminUserRow[];
  currentUserId: string;
};

const ROLE_ORDER: ProfileRole[] = [
  "admin",
  "head_teacher",
  "teacher",
  "student",
];

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

function createdAtTimestamp(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return time;
}

function displayName(user: AdminUserRow): string {
  return (
    user.fullName?.trim() ||
    user.email?.split("@")[0] ||
    user.id.slice(0, 8)
  );
}

function RoleBadge({ role }: { role: ProfileRole }) {
  const label = getRoleTranslation(role);
  const className =
    role === "student"
      ? "border-blue-500/40 bg-blue-500/10 font-medium text-blue-800 dark:text-blue-200"
      : role === "teacher"
        ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200"
        : role === "admin"
          ? "border-violet-500/40 bg-violet-500/10 font-medium text-violet-800 dark:text-violet-200"
          : "border-amber-500/40 bg-amber-500/10 font-medium text-amber-800 dark:text-amber-200";

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
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
  const [userToDelete, setUserToDelete] = useState<AdminUserRow | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [userDangerAction, setUserDangerAction] =
    useState<UserDangerAction>("delete");
  const [resetPasswordUser, setResetPasswordUser] =
    useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "createdAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [roleFilter, setRoleFilter] = useState<ProfileRole | "all">("all");

  const uniqueRoles = useMemo(() => {
    const roles = new Set(users.map((user) => user.role));
    return ROLE_ORDER.filter((role) => roles.has(role));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    const normalized = searchQuery.trim().toLowerCase();

    if (normalized) {
      result = result.filter(
        (user) =>
          displayName(user).toLowerCase().includes(normalized) ||
          (user.email?.toLowerCase().includes(normalized) ?? false),
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    if (sortOrder) {
      result = [...result].sort((a, b) => {
        if (sortField === "createdAt") {
          const aTime = createdAtTimestamp(a.createdAt);
          const bTime = createdAtTimestamp(b.createdAt);
          if (aTime === null && bTime === null) {
            return 0;
          }
          if (aTime === null) {
            return 1;
          }
          if (bTime === null) {
            return -1;
          }
          const comparison = aTime - bTime;
          return sortOrder === "asc" ? comparison : -comparison;
        }

        const comparison = displayName(a).localeCompare(displayName(b), "ru");
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [users, searchQuery, roleFilter, sortField, sortOrder]);

  const columns = useMemo(() => [{ accessorKey: "id" as const }], []);

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

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

  function openUserDangerDialog(user: AdminUserRow, action: UserDangerAction) {
    setUserToDelete(user);
    setUserDangerAction(action);
    setDeleteConfirmText("");
    setIsDeleteDialogOpen(true);
  }

  function closeUserDangerDialog() {
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
    setDeleteConfirmText("");
    setUserDangerAction("delete");
  }

  const requiredConfirmWord =
    userDangerAction === "delete" ? "удалить" : "деактивировать";
  const confirmPromptWord =
    userDangerAction === "delete" ? "Удалить" : "Деактивировать";

  function handleDangerConfirm() {
    if (!userToDelete) {
      return;
    }

    const targetId = userToDelete.id;
    startTransition(async () => {
      const result =
        userDangerAction === "delete"
          ? await deleteUser(targetId)
          : await deactivateUser(targetId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        userDangerAction === "delete"
          ? "Пользователь удалён"
          : "Пользователь деактивирован. Курсы остаются активными — смените владельца при необходимости.",
      );
      closeUserDangerDialog();
      router.refresh();
    });
  }

  function handleActivateUser(user: AdminUserRow) {
    startTransition(async () => {
      const result = await activateUser(user.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Пользователь активирован");
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
      <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          placeholder="Поиск по имени или email…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full sm:max-w-sm"
          aria-label="Поиск по имени или email пользователя"
        />
        <CreateUserDialog />
      </div>

      <div className="custom-scrollbar w-full overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-medium"
                    >
                      Пользователь
                      <ArrowUpDown className="ml-2 size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("name");
                        setSortOrder(null);
                      }}
                    >
                      По умолчанию
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("name");
                        setSortOrder("asc");
                      }}
                    >
                      А → Я
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("name");
                        setSortOrder("desc");
                      }}
                    >
                      Я → А
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              <TableHead>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-medium"
                    >
                      Роль
                      <ChevronDown className="ml-2 size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setRoleFilter("all")}>
                      Все роли
                    </DropdownMenuItem>
                    {uniqueRoles.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => setRoleFilter(role)}
                      >
                        {getRoleTranslation(role)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              <TableHead>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-medium"
                    >
                      Дата регистрации
                      <ArrowUpDown className="ml-2 size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("createdAt");
                        setSortOrder(null);
                      }}
                    >
                      По умолчанию
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("createdAt");
                        setSortOrder("asc");
                      }}
                    >
                      Ранние → Новые
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSortField("createdAt");
                        setSortOrder("desc");
                      }}
                    >
                      Новые → Ранние
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
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
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {searchQuery.trim()
                    ? `Нет пользователей по запросу «${searchQuery.trim()}».`
                    : "Нет пользователей по выбранным фильтрам."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((tableRow) => {
                  const user = tableRow.original;
                  const isSelf = user.id === currentUserId;
                  const isActive = user.isActive !== false;
                  return (
                    <TableRow
                      key={user.id}
                      className={isActive ? undefined : "opacity-60"}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage
                              src={user.avatarUrl ?? undefined}
                              alt={displayName(user)}
                            />
                            <AvatarFallback className="text-xs">
                              {initialsFromDisplayName(displayName(user))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2 font-medium text-foreground">
                              {displayName(user)}
                            </span>
                            {user.email ? (
                              <span className="truncate text-sm text-muted-foreground">
                                {user.email}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <RoleBadge role={user.role} />
                          {!isActive ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px] uppercase px-1.5 py-0.5 leading-none"
                            >
                              Деактивирован
                            </Badge>
                          ) : null}
                        </div>
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
                                    <GraduationCap className="size-4" aria-hidden />
                                    Сделать Учителем
                                  </DropdownMenuItem>
                                )}
                                {user.role !== "student" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "student")
                                    }
                                  >
                                    <User className="size-4" aria-hidden />
                                    Сделать Студентом
                                  </DropdownMenuItem>
                                )}
                                {user.role !== "admin" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "admin")
                                    }
                                  >
                                    <Shield className="size-4" aria-hidden />
                                    Сделать Админом
                                  </DropdownMenuItem>
                                )}
                                {user.role !== "head_teacher" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRoleChange(user.id, "head_teacher")
                                    }
                                  >
                                    <Crown className="size-4" aria-hidden />
                                    Сделать Руководителем
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => openResetPasswordDialog(user)}
                                >
                                  <Key className="size-4" aria-hidden />
                                  Сбросить пароль
                                </DropdownMenuItem>
                                {isActive ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      openUserDangerDialog(user, "deactivate")
                                    }
                                  >
                                    <UserX className="size-4" aria-hidden />
                                    Деактивировать
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleActivateUser(user)}
                                  >
                                    <UserCheck className="size-4" aria-hidden />
                                    Активировать
                                  </DropdownMenuItem>
                                )}
                                {!isActive ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() =>
                                        openUserDangerDialog(user, "delete")
                                      }
                                    >
                                      <Trash2 className="size-4" aria-hidden />
                                      Удалить
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
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
      <DataTablePagination table={table} />

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
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            closeUserDangerDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userDangerAction === "delete"
                ? "Удалить пользователя?"
                : "Деактивировать пользователя?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete
                ? `Вы собираетесь ${
                    userDangerAction === "delete" ? "удалить" : "деактивировать"
                  } ${displayName(userToDelete)}${
                    userToDelete.email ? ` (${userToDelete.email})` : ""
                  }. Это действие необратимо.`
                : "Это действие необратимо."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">
              Введите слово{" "}
              <span className="font-bold text-foreground">{confirmPromptWord}</span>{" "}
              для подтверждения:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              autoComplete="off"
              aria-label="Подтверждение действия с пользователем"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Отмена
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive-outline"
                disabled={
                  isPending ||
                  deleteConfirmText.trim().toLowerCase() !== requiredConfirmWord
                }
                onClick={handleDangerConfirm}
              >
                {isPending
                  ? userDangerAction === "delete"
                    ? "Удаление…"
                    : "Деактивация…"
                  : confirmPromptWord}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
