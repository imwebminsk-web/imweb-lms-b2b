"use client";

import { ArrowUpDown, ChevronDown, MoreHorizontal, PlusIcon, Trash2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
} from "@/app/actions/admin-actions";
import {
  createB2BUser,
  getB2BFormOptions,
  getB2BUsers,
} from "@/app/actions/b2b-user-actions";
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
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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

type FormOption = { id: string; name: string };
type TaxonomyOption = { id: string; label: string };

type B2BUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  teams: string[];
  jobTitles: string[];
  tags: string[];
  isActive: boolean;
};

type CorporateDangerAction = "delete" | "deactivate";

type RawProfile = {
  id: string;
  full_name: string | null;
  is_active?: boolean | null;
  profile_secrets:
    | { email: string | null }
    | { email: string | null }[]
    | null;
  team_members:
    | Array<{
        teams: { name: string } | { name: string }[] | null;
        job_titles: { name: string } | { name: string }[] | null;
      }>
    | null;
  user_taxonomies:
    | Array<{
        taxonomies: { id: string; label: string } | { id: string; label: string }[] | null;
      }>
    | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapProfileToRow(profile: RawProfile): B2BUserRow {
  const secret = unwrapRelation(profile.profile_secrets);
  const teams: string[] = [];
  const jobTitles: string[] = [];
  const tags: string[] = [];

  for (const membership of profile.team_members ?? []) {
    const team = unwrapRelation(membership.teams);
    const jobTitle = unwrapRelation(membership.job_titles);
    if (team?.name) teams.push(team.name);
    if (jobTitle?.name) jobTitles.push(jobTitle.name);
  }

  for (const link of profile.user_taxonomies ?? []) {
    const taxonomy = unwrapRelation(link.taxonomies);
    if (taxonomy?.label) tags.push(taxonomy.label);
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: secret?.email ?? null,
    teams,
    jobTitles,
    tags,
    isActive: profile.is_active !== false,
  };
}

const emptyForm = {
  email: "",
  fullName: "",
  teamId: "",
  jobTitleId: "",
  taxonomyIds: [] as string[],
};

function b2bDisplayName(user: B2BUserRow): string {
  return user.fullName?.trim() || user.email?.split("@")[0] || "—";
}

export function CorporateUsersTable() {
  const [users, setUsers] = useState<B2BUserRow[]>([]);
  const [teams, setTeams] = useState<FormOption[]>([]);
  const [jobTitles, setJobTitles] = useState<FormOption[]>([]);
  const [taxonomies, setTaxonomies] = useState<TaxonomyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [userToDelete, setUserToDelete] = useState<B2BUserRow | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [userDangerAction, setUserDangerAction] =
    useState<CorporateDangerAction>("delete");

  const requiredConfirmWord =
    userDangerAction === "delete" ? "удалить" : "деактивировать";
  const confirmPromptWord =
    userDangerAction === "delete" ? "Удалить" : "Деактивировать";

  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    for (const user of users) {
      for (const team of user.teams) {
        teams.add(team);
      }
    }
    return [...teams].sort((a, b) => a.localeCompare(b, "ru"));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    const normalized = searchQuery.trim().toLowerCase();

    if (normalized) {
      result = result.filter(
        (user) =>
          b2bDisplayName(user).toLowerCase().includes(normalized) ||
          (user.email?.toLowerCase().includes(normalized) ?? false),
      );
    }

    if (teamFilter !== "all") {
      result = result.filter((user) => user.teams.includes(teamFilter));
    }

    if (sortOrder) {
      result = [...result].sort((a, b) => {
        const comparison = b2bDisplayName(a).localeCompare(
          b2bDisplayName(b),
          "ru",
        );
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [users, searchQuery, teamFilter, sortOrder]);

  const columns = useMemo(() => [{ accessorKey: "id" as const }], []);

  const table = useReactTable({
    data: isLoading ? [] : filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [usersResult, optionsResult] = await Promise.all([
      getB2BUsers(),
      getB2BFormOptions(),
    ]);

    if (!usersResult.success) {
      toast.error(usersResult.error);
      setUsers([]);
    } else {
      setUsers(
        (usersResult.data as RawProfile[]).map(mapProfileToRow),
      );
    }

    if (!optionsResult.success) {
      toast.error(optionsResult.error);
      setTeams([]);
      setJobTitles([]);
      setTaxonomies([]);
    } else {
      setTeams(optionsResult.data.teams);
      setJobTitles(optionsResult.data.jobTitles);
      setTaxonomies(optionsResult.data.taxonomies);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openUserDangerDialog(user: B2BUserRow, action: CorporateDangerAction) {
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
      await loadData();
    });
  }

  function handleActivateUser(user: B2BUserRow) {
    startTransition(async () => {
      const result = await activateUser(user.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Пользователь активирован");
      await loadData();
    });
  }

  function openCreateDialog() {
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function toggleTaxonomy(taxonomyId: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      taxonomyIds: checked
        ? [...prev.taxonomyIds, taxonomyId]
        : prev.taxonomyIds.filter((id) => id !== taxonomyId),
    }));
  }

  function handleSubmit() {
    if (!form.email.trim() || !form.fullName.trim()) {
      setFormError("Укажите email и полное имя.");
      return;
    }
    if (!form.teamId || !form.jobTitleId) {
      setFormError("Выберите отдел и должность.");
      return;
    }

    startTransition(async () => {
      setFormError(null);
      const result = await createB2BUser({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        teamId: form.teamId,
        jobTitleId: form.jobTitleId,
        taxonomyIds: form.taxonomyIds,
      });

      if (!result.success) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Сотрудник успешно добавлен");
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-4 border-b px-6 py-4">
        <Input
          type="search"
          placeholder="Поиск по имени или email…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full sm:max-w-sm"
          aria-label="Поиск по имени или email сотрудника"
        />
        <Button
          type="button"
          onClick={openCreateDialog}
          disabled={isLoading || isPending}
          className="w-full shrink-0 sm:w-auto"
        >
          <PlusIcon />
          Добавить сотрудника
        </Button>
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
                      ФИО
                      <ArrowUpDown className="ml-2 size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setSortOrder(null)}>
                      По умолчанию
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("asc")}>
                      А → Я
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("desc")}>
                      Я → А
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-medium"
                    >
                      Отдел
                      <ChevronDown className="ml-2 size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setTeamFilter("all")}>
                      Все отделы
                    </DropdownMenuItem>
                    {uniqueTeams.map((team) => (
                      <DropdownMenuItem
                        key={team}
                        onClick={() => setTeamFilter(team)}
                      >
                        {team}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Теги</TableHead>
              <TableHead className="w-12 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-10 text-center"
                >
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-10 text-center"
                >
                  Сотрудников пока нет. Добавьте первого сотрудника.
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-10 text-center"
                >
                  {searchQuery.trim()
                    ? `Нет сотрудников по запросу «${searchQuery.trim()}».`
                    : "Нет сотрудников по выбранным фильтрам."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((tableRow) => {
                const user = tableRow.original;
                const isActive = user.isActive !== false;

                return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.fullName?.trim() || "—"}
                  </TableCell>
                  <TableCell>{user.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span>
                        {user.teams.length > 0 ? user.teams.join(", ") : "—"}
                      </span>
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
                  <TableCell>
                    {user.jobTitles.length > 0
                      ? user.jobTitles.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.tags.length > 0 ? (
                        user.tags.map((tag) => (
                          <Badge key={`${user.id}-${tag}`} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          aria-label={`Действия для ${b2bDisplayName(user)}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
      {!isLoading ? <DataTablePagination table={table} /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {formError ? (
              <p className="text-destructive text-sm">{formError}</p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="b2b-email">Email</Label>
              <Input
                id="b2b-email"
                type="email"
                className="rounded-xl"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="employee@company.com"
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="b2b-full-name">ФИО</Label>
              <Input
                id="b2b-full-name"
                className="rounded-xl"
                value={form.fullName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                placeholder="Иван Иванов"
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label>Отдел</Label>
              <Select
                value={form.teamId}
                onValueChange={(teamId) =>
                  setForm((prev) => ({ ...prev, teamId }))
                }
                disabled={isPending}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Должность</Label>
              <Select
                value={form.jobTitleId}
                onValueChange={(jobTitleId) =>
                  setForm((prev) => ({ ...prev, jobTitleId }))
                }
                disabled={isPending}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((jobTitle) => (
                    <SelectItem key={jobTitle.id} value={jobTitle.id}>
                      {jobTitle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {taxonomies.length > 0 ? (
              <div className="grid gap-2">
                <Label>Теги</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {taxonomies.map((taxonomy) => {
                    const checked = form.taxonomyIds.includes(taxonomy.id);
                    return (
                      <label
                        key={taxonomy.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleTaxonomy(taxonomy.id, value === true)
                          }
                          disabled={isPending}
                        />
                        <span>{taxonomy.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "Сохранение..." : "Создать"}
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
                  } ${b2bDisplayName(userToDelete)}${
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
              aria-label="Подтверждение действия с сотрудником"
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
