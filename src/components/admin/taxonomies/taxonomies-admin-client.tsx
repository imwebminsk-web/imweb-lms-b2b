"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { slugify } from "@/lib/utils/slug";

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
  const [valueToDelete, setValueToDelete] = useState<TaxonomyWithGroup | null>(
    null,
  );
  const [isValueDeleteDialogOpen, setIsValueDeleteDialogOpen] = useState(false);
  const [deleteValueConfirmText, setDeleteValueConfirmText] = useState("");
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [form, setForm] = useState<FormState>(
    emptyForm(initialGroups[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setGroups(initialGroups);
    setTaxonomies(initialTaxonomies);
  }, [initialGroups, initialTaxonomies]);

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
      slug: groupSlugManual ? prev.slug : slugify(name),
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
      if (!result.ok) {
        toast.error(result.error);
        setGroupError(result.error);
        return;
      }

      toast.success("Категория создана");
      setActiveTab(groupForm.slug);
      setGroupFormOpen(false);
      setGroupForm(emptyGroupForm());
      setGroupSlugManual(false);
      router.refresh();
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

  function handleLabelChange(label: string) {
    setForm((prev) => ({
      ...prev,
      label,
      value: slugify(label),
    }));
  }

  function handleSubmit() {
    startTransition(async () => {
      setError(null);
      const value =
        editing && form.label.trim() === editing.label
          ? editing.value
          : slugify(form.label);
      const payload = {
        group_id: form.group_id,
        label: form.label,
        value,
        sort_order: Number(form.sort_order),
      };

      const result = editing
        ? await updateTaxonomy(editing.id, payload)
        : await createTaxonomy(payload);

      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }

      toast.success(editing ? "Запись сохранена" : "Значение добавлено");
      setFormOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function handleToggle(row: TaxonomyWithGroup) {
    startTransition(async () => {
      setError(null);
      const result = await toggleTaxonomyActive(row.id, row.is_active);
      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      toast.success(row.is_active ? "Значение скрыто" : "Значение включено");
      router.refresh();
    });
  }

  function openValueDeleteDialog(row: TaxonomyWithGroup) {
    setValueToDelete(row);
    setDeleteValueConfirmText("");
    setIsValueDeleteDialogOpen(true);
  }

  function closeValueDeleteDialog() {
    setIsValueDeleteDialogOpen(false);
    setValueToDelete(null);
    setDeleteValueConfirmText("");
  }

  function handleDeleteValue() {
    if (!valueToDelete) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteTaxonomy(valueToDelete.id);
      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      toast.success("Значение удалено");
      closeValueDeleteDialog();
      router.refresh();
    });
  }

  function handleConfirmDeleteGroup() {
    if (!deleteGroupTarget) return;

    const groupId = deleteGroupTarget;
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      setDeleteGroupTarget(null);
      setDeleteConfirmText("");
      return;
    }

    startTransition(async () => {
      setIsDeletingGroup(groupId);
      setGroupError(null);
      setGroupSuccess(null);

      const result = await deleteTaxonomyGroup(groupId);

      setIsDeletingGroup(null);

      if (!result.ok) {
        toast.error(result.error);
        setGroupError(result.error);
        return;
      }

      toast.success(`Категория «${group.name}» и все её теги удалены.`);
      setGroupSuccess(`Категория «${group.name}» и все её теги удалены.`);
      if (activeTab === group.slug) {
        const remaining = groups.filter((item) => item.id !== groupId);
        setActiveTab(remaining[0]?.slug ?? "");
      }
      setDeleteGroupTarget(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  }

  const deleteGroup =
    deleteGroupTarget !== null
      ? groups.find((item) => item.id === deleteGroupTarget)
      : null;

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        {groupError ? (
          <p className="text-destructive rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            {groupError}
          </p>
        ) : null}
        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-end gap-4 border-b px-6 py-4">
            <Button
              type="button"
              onClick={openCreateGroup}
              disabled={pending}
            >
              Создать категорию
            </Button>
          </div>
          <p className="text-muted-foreground px-6 py-12 text-center text-sm">
            Категорий пока нет. Создайте первую группу фильтров для каталога.
          </p>
        </section>

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          variant="line"
          className="mb-6 h-auto w-full flex-wrap justify-start"
        >
          {groups.map((group) => (
            <TabsTrigger
              key={group.id}
              value={group.slug}
              className="inline-flex items-center gap-2"
            >
              {group.name}
              <Badge variant="outline">
                {grouped.get(group.slug)?.length ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((group) => (
          <TabsContent key={group.id} value={group.slug} className="mt-0">
            <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b px-6 py-4 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteGroupTarget(group.id)}
                  disabled={pending || isDeletingGroup === group.id}
                >
                  {isDeletingGroup === group.id
                    ? "Удаление..."
                    : "Удалить категорию"}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openCreate(group)}
                    disabled={pending || isDeletingGroup !== null}
                  >
                    Добавить значение
                  </Button>
                  <Button
                    type="button"
                    onClick={openCreateGroup}
                    disabled={pending}
                  >
                    Создать категорию
                  </Button>
                </div>
              </div>

              <div className="custom-scrollbar w-full overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Подпись</TableHead>
                      <TableHead className="w-24 text-center">Порядок</TableHead>
                      <TableHead className="w-28 text-center">Активно</TableHead>
                      <TableHead className="w-12 text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(grouped.get(group.slug) ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={pending}
                                  aria-label={`Действия для ${row.label}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => openEdit(row)}>
                                  <PencilIcon className="size-4" aria-hidden />
                                  Редактировать
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => openValueDeleteDialog(row)}
                                >
                                  <Trash2Icon className="size-4" aria-hidden />
                                  Удалить
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
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
        <DialogContent className="sm:max-w-md">
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
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Например, Онлайн"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxonomy-sort">Порядок сортировки</Label>
              <Input
                id="taxonomy-sort"
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
              onClick={() => setFormOpen(false)}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
            >
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isValueDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !pending) {
            closeValueDeleteDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить значение?</AlertDialogTitle>
            <AlertDialogDescription>
              {valueToDelete
                ? `Вы собираетесь удалить значение «${valueToDelete.label}». Это действие необратимо.`
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
              value={deleteValueConfirmText}
              onChange={(event) => setDeleteValueConfirmText(event.target.value)}
              autoComplete="off"
              aria-label="Подтверждение удаления значения"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="border-input text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring"
                disabled={pending}
              >
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive-outline"
              onClick={handleDeleteValue}
              disabled={
                pending ||
                deleteValueConfirmText.trim().toLowerCase() !== "удалить"
              }
            >
              {pending ? "Удаление…" : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteGroupTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleteGroupTarget(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroup
                ? `Категория «${deleteGroup.name}» и все её значения будут удалены без возможности восстановления.`
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
              aria-label="Подтверждение удаления категории"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={pending || isDeletingGroup !== null}
              >
                Отмена
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive-outline"
                disabled={
                  pending ||
                  isDeletingGroup !== null ||
                  deleteConfirmText.trim().toLowerCase() !== "удалить"
                }
                onClick={handleConfirmDeleteGroup}
              >
                {isDeletingGroup !== null ? "Удаление…" : "Удалить"}
              </Button>
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
    <DialogContent className="sm:max-w-md">
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
            value={groupForm.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Например, Отдел"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="group-slug">Slug</Label>
          <Input
            id="group-slug"
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
          onClick={onCancel}
          disabled={pending}
        >
          Отмена
        </Button>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          Создать
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
