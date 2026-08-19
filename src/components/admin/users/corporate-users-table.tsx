"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createB2BUser,
  getB2BFormOptions,
  getB2BUsers,
} from "@/app/actions/b2b-user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
};

type RawProfile = {
  id: string;
  full_name: string | null;
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
  };
}

const emptyForm = {
  email: "",
  fullName: "",
  teamId: "",
  jobTitleId: "",
  taxonomyIds: [] as string[],
};

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
    <div className="flex min-w-0 flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Сотрудники</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Управление корпоративными пользователями, отделами и тегами.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-xl"
          onClick={openCreateDialog}
          disabled={isLoading || isPending}
        >
          <PlusIcon />
          Добавить сотрудника
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Отдел</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Теги</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-10 text-center"
                >
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-10 text-center"
                >
                  Сотрудников пока нет. Добавьте первого сотрудника.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.fullName?.trim() || "—"}
                  </TableCell>
                  <TableCell>{user.email ?? "—"}</TableCell>
                  <TableCell>
                    {user.teams.length > 0 ? user.teams.join(", ") : "—"}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
}
