"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  createTaxonomy,
  createTaxonomyGroup,
  deleteTaxonomy,
  deleteTaxonomyGroup,
  toggleTaxonomyActive,
  updateTaxonomy,
  type TaxonomyGroupRow,
  type TaxonomyWithGroup,
} from "@/app/actions/taxonomy-actions";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type FormState = {
  group_id: string;
  label: string;
  value: string;
  sort_order: string;
};

const emptyForm = (groupId: string): FormState => ({
  group_id: groupId,
  label: "",
  value: "",
  sort_order: "0",
});

type GroupFormState = {
  name: string;
  slug: string;
};

const emptyGroupForm = (): GroupFormState => ({
  name: "",
  slug: "",
});

/** Простая генерация slug из названия (латиница; кириллицу вводят вручную). */
function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type TaxonomiesAdminClientProps = {
  initialTaxonomies: TaxonomyWithGroup[];
  initialGroups: TaxonomyGroupRow[];
};

export function TaxonomiesAdminClient({
  initialTaxonomies,
  initialGroups,
}: TaxonomiesAdminClientProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [taxonomies, setTaxonomies] = useState(initialTaxonomies);
  const [activeTab, setActiveTab] = useState(initialGroups[0]?.slug ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [groupSlugManual, setGroupSlugManual] = useState(false);
  const [editing, setEditing] = useState<TaxonomyWithGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyWithGroup | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(
    emptyForm(initialGroups[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, TaxonomyWithGroup[]>();
    for (const group of groups) {
      map.set(group.slug, []);
    }
    for (const row of taxonomies) {
      const bucket = map.get(row.group_slug);
      if (bucket) bucket.push(row);
    }
    return map;
  }, [groups, taxonomies]);

  const activeGroup =
    groups.find((group) => group.slug === activeTab) ?? groups[0];

  function openCreateGroup() {
    setGroupForm(emptyGroupForm());
    setGroupSlugManual(false);
    setGroupError(null);
    setGroupFormOpen(true);
  }

  function handleGroupNameChange(name: string) {
    setGroupForm((prev) => ({
      name,
      slug: groupSlugManual ? prev.slug : slugFromName(name),
    }));
  }

  function handleGroupSlugChange(slug: string) {
    setGroupSlugManual(true);
    setGroupForm((prev) => ({
      ...prev,
      slug: slug.toLowerCase(),
    }));
  }

  function handleCreateGroup() {
    startTransition(async () => {
      setGroupError(null);
      setGroupSuccess(null);
      const result = await createTaxonomyGroup(groupForm);
      if (!result.success) {
        setGroupError(result.error);
        return;
      }

      setGroups((prev) =>
        [...prev, result.data].sort((a, b) => a.slug.localeCompare(b.slug)),
      );
      setActiveTab(result.data.slug);
      setGroupFormOpen(false);
      setGroupForm(emptyGroupForm());
      setGroupSlugManual(false);
    });
  }

  function openCreate(group: TaxonomyGroupRow) {
    setEditing(null);
    setForm(emptyForm(group.id));
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: TaxonomyWithGroup) {
    setEditing(row);
    setForm({
      group_id: row.group_id,
      label: row.label,
      value: row.value,
      sort_order: String(row.sort_order),
    });
    setError(null);
    setFormOpen(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      setError(null);
      const payload = {
        group_id: form.group_id,
        label: form.label,
        value: form.value,
        sort_order: Number(form.sort_order),
      };

      const result = editing
        ? await updateTaxonomy(editing.id, payload)
        : await createTaxonomy(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setTaxonomies((prev) => {
        if (editing) {
          return prev.map((row) =>
            row.id === result.data.id ? result.data : row,
          );
        }
        return [...prev, result.data];
      });
      setFormOpen(false);
      setEditing(null);
    });
  }

  function handleToggle(row: TaxonomyWithGroup) {
    startTransition(async () => {
      setError(null);
      const result = await toggleTaxonomyActive(row.id, row.is_active);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTaxonomies((prev) =>
        prev.map((item) => (item.id === row.id ? result.data : item)),
      );
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteTaxonomy(deleteTarget.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTaxonomies((prev) =>
        prev.filter((row) => row.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    });
  }

  async function handleDeleteGroup(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    if (
      !window.confirm(
        "Удалить эту категорию и все ее теги?",
      )
    ) {
      return;
    }

    setIsDeletingGroup(groupId);
    setGroupError(null);
    setGroupSuccess(null);

    const result = await deleteTaxonomyGroup(groupId);

    setIsDeletingGroup(null);

    if (!result.success) {
      setGroupError(result.error);
      return;
    }

    const remainingGroups = groups.filter((item) => item.id !== groupId);
    setGroups(remainingGroups);
    setTaxonomies((prev) => prev.filter((row) => row.group_id !== groupId));

    if (activeTab === group.slug) {
      setActiveTab(remainingGroups[0]?.slug ?? "");
    }

    setGroupSuccess(`Категория «${group.name}» и все её теги удалены.`);
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            className="rounded-xl"
            onClick={openCreateGroup}
            disabled={pending}
          >
            <PlusIcon />
            Создать категорию
          </Button>
        </div>
        {groupError ? (
          <p className="text-destructive rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            {groupError}
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm">
          Категорий пока нет. Создайте первую группу фильтров для каталога.
        </p>

        <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
          <GroupCreateDialogContent
            groupForm={groupForm}
            groupError={groupError}
            pending={pending}
            onNameChange={handleGroupNameChange}
            onSlugChange={handleGroupSlugChange}
            onCancel={() => setGroupFormOpen(false)}
            onSubmit={handleCreateGroup}
          />
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          className="rounded-xl"
          onClick={openCreateGroup}
          disabled={pending}
        >
          <PlusIcon />
          Создать категорию
        </Button>
      </div>

      {groupError ? (
        <p className="text-destructive rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          {groupError}
        </p>
      ) : null}

      {groupSuccess ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {groupSuccess}
        </p>
      ) : null}

      {error ? (
        <p className="text-destructive rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap rounded-xl">
          {groups.map((group) => (
            <TabsTrigger
              key={group.id}
              value={group.slug}
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {group.name}
              <Badge variant="secondary" className="ml-2">
                {grouped.get(group.slug)?.length ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((group) => (
          <TabsContent key={group.id} value={group.slug} className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <p className="text-muted-foreground text-sm">
                  Значения справочника для фильтров каталога и форм курсов.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => handleDeleteGroup(group.id)}
                  disabled={pending || isDeletingGroup === group.id}
                >
                  <Trash2Icon />
                  {isDeletingGroup === group.id
                    ? "Удаление..."
                    : "Удалить категорию"}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => openCreate(group)}
                  disabled={pending || isDeletingGroup !== null}
                >
                  <PlusIcon />
                  Добавить
                </Button>
              </div>
            </div>

            <div className="border-border overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Подпись</TableHead>
                    <TableHead>Значение</TableHead>
                    <TableHead className="w-24 text-center">Порядок</TableHead>
                    <TableHead className="w-28 text-center">Активно</TableHead>
                    <TableHead className="w-36 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(grouped.get(group.slug) ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Записей пока нет. Добавьте первое значение.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (grouped.get(group.slug) ?? []).map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(!row.is_active && "opacity-60")}
                      >
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>
                          <code className="bg-muted rounded-md px-2 py-1 text-xs">
                            {row.value}
                          </code>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.sort_order}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={row.is_active}
                            disabled={pending}
                            onCheckedChange={() => handleToggle(row)}
                            aria-label={`Активность: ${row.label}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="rounded-xl"
                              onClick={() => openEdit(row)}
                              disabled={pending}
                              aria-label={`Редактировать ${row.label}`}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive rounded-xl"
                              onClick={() => setDeleteTarget(row)}
                              disabled={pending}
                              aria-label={`Удалить ${row.label}`}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
        <GroupCreateDialogContent
          groupForm={groupForm}
          groupError={groupError}
          pending={pending}
          onNameChange={handleGroupNameChange}
          onSlugChange={handleGroupSlugChange}
          onCancel={() => setGroupFormOpen(false)}
          onSubmit={handleCreateGroup}
        />
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать запись" : "Новая запись"}
              {activeGroup ? ` — ${activeGroup.name}` : null}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="taxonomy-label">Подпись (label)</Label>
              <Input
                id="taxonomy-label"
                className="rounded-xl"
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="Например, Онлайн"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxonomy-value">Значение (value)</Label>
              <Input
                id="taxonomy-value"
                className="rounded-xl"
                value={form.value}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    value: e.target.value.toLowerCase(),
                  }))
                }
                placeholder="online"
              />
              <p className="text-muted-foreground text-xs">
                Латиница, цифры и дефис: `english`, `b1-plus`, `5-6`
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxonomy-sort">Порядок сортировки</Label>
              <Input
                id="taxonomy-sort"
                className="rounded-xl"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sort_order: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFormOpen(false)}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={pending}
            >
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `«${deleteTarget.label}» (${deleteTarget.value}) будет удалена без возможности восстановления.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={pending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={handleDelete}
              disabled={pending}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type GroupCreateDialogContentProps = {
  groupForm: GroupFormState;
  groupError: string | null;
  pending: boolean;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function GroupCreateDialogContent({
  groupForm,
  groupError,
  pending,
  onNameChange,
  onSlugChange,
  onCancel,
  onSubmit,
}: GroupCreateDialogContentProps) {
  return (
    <DialogContent className="rounded-xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Новая категория</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        {groupError ? (
          <p className="text-destructive text-sm">{groupError}</p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="group-name">Название группы</Label>
          <Input
            id="group-name"
            className="rounded-xl"
            value={groupForm.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Например, Отдел"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="group-slug">Slug</Label>
          <Input
            id="group-slug"
            className="rounded-xl"
            value={groupForm.slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="department"
          />
          <p className="text-muted-foreground text-xs">
            Латиница, цифры и дефис. Можно ввести вручную или сгенерировать из
            названия.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onCancel}
          disabled={pending}
        >
          Отмена
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          onClick={onSubmit}
          disabled={pending}
        >
          Создать
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
