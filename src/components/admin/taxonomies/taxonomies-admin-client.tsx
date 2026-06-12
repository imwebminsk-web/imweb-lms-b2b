"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  createTaxonomy,
  deleteTaxonomy,
  toggleTaxonomyActive,
  updateTaxonomy,
  type TaxonomyRow,
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

const TAXONOMY_TYPES = [
  "format",
  "language",
  "audience",
  "age_group",
  "cefr_level",
] as const;

type TaxonomyType = (typeof TAXONOMY_TYPES)[number];

const TYPE_LABELS: Record<TaxonomyType, string> = {
  format: "Формат",
  language: "Язык",
  audience: "Аудитория",
  age_group: "Возраст",
  cefr_level: "Уровень CEFR",
};

type FormState = {
  type: TaxonomyType;
  label: string;
  value: string;
  sort_order: string;
};

const emptyForm = (type: TaxonomyType): FormState => ({
  type,
  label: "",
  value: "",
  sort_order: "0",
});

type TaxonomiesAdminClientProps = {
  initialTaxonomies: TaxonomyRow[];
};

export function TaxonomiesAdminClient({
  initialTaxonomies,
}: TaxonomiesAdminClientProps) {
  const [taxonomies, setTaxonomies] = useState(initialTaxonomies);
  const [activeTab, setActiveTab] = useState<TaxonomyType>("format");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxonomyRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm("format"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<TaxonomyType, TaxonomyRow[]>();
    for (const type of TAXONOMY_TYPES) {
      map.set(type, []);
    }
    for (const row of taxonomies) {
      const bucket = map.get(row.type as TaxonomyType);
      if (bucket) bucket.push(row);
    }
    return map;
  }, [taxonomies]);

  function openCreate(type: TaxonomyType) {
    setEditing(null);
    setForm(emptyForm(type));
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: TaxonomyRow) {
    setEditing(row);
    setForm({
      type: row.type as TaxonomyType,
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
        type: form.type,
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

  function handleToggle(row: TaxonomyRow) {
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

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-destructive rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TaxonomyType)}
      >
        <TabsList className="h-auto flex-wrap rounded-xl">
          {TAXONOMY_TYPES.map((type) => (
            <TabsTrigger
              key={type}
              value={type}
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {TYPE_LABELS[type]}
              <Badge variant="secondary" className="ml-2">
                {grouped.get(type)?.length ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAXONOMY_TYPES.map((type) => (
          <TabsContent key={type} value={type} className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{TYPE_LABELS[type]}</h2>
                <p className="text-muted-foreground text-sm">
                  Значения справочника для фильтров каталога и форм курсов.
                </p>
              </div>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => openCreate(type)}
                disabled={pending}
              >
                <PlusIcon />
                Добавить
              </Button>
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
                  {(grouped.get(type) ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Записей пока нет. Добавьте первое значение.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (grouped.get(type) ?? []).map((row) => (
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать запись" : "Новая запись"}
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
