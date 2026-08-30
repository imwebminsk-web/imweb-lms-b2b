"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  addCourseCurator,
  getAvailableCurators,
  getCourseCurators,
  removeCourseCurator,
  type CourseCurator,
  type CuratorCandidate,
} from "@/app/actions/curator-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRoleTranslation } from "@/lib/utils/role-utils";
import {
  manageCuratorSchema,
  type ManageCuratorPayload,
} from "@/lib/validations/course-schemas";

export function ManageCuratorsModal({
  courseId,
  isOpen,
  onClose,
}: {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isLoading, startLoadTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const [curators, setCurators] = useState<CourseCurator[]>([]);
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManageCuratorPayload>({
    resolver: zodResolver(manageCuratorSchema),
    defaultValues: {
      courseId,
      userId: "",
    },
  });

  function loadLists() {
    if (!courseId) {
      return;
    }

    startLoadTransition(async () => {
      const [assigned, available] = await Promise.all([
        getCourseCurators(courseId),
        getAvailableCurators(),
      ]);

      if (assigned.error) {
        toast.error(assigned.error);
      }
      if (available.error) {
        toast.error(available.error);
      }

      setCurators(assigned.data ?? []);
      setCandidates(available.data ?? []);
    });
  }

  useEffect(() => {
    reset({ courseId, userId: "" });

    if (!isOpen) {
      return;
    }

    loadLists();
    // Загружаем только при открытии модалки и смене курса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, courseId, reset]);

  const assignable = useMemo(() => {
    const assignedIds = new Set(curators.map((c) => c.userId));
    return candidates.filter((c) => !assignedIds.has(c.id));
  }, [candidates, curators]);

  async function onSubmit(values: ManageCuratorPayload) {
    const result = await addCourseCurator(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Куратор назначен");
    reset({ courseId: values.courseId, userId: "" });
    loadLists();
    router.refresh();
  }

  function handleRemove(userId: string) {
    if (isRemoving || isSubmitting) {
      return;
    }

    startRemoveTransition(async () => {
      const result = await removeCourseCurator({ courseId, userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Куратор снят");
      loadLists();
      router.refresh();
    });
  }

  const busy = isLoading || isSubmitting || isRemoving;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Кураторы курса</DialogTitle>
          <DialogDescription>
            Назначьте преподавателя или завуча, который сможет редактировать
            курс, но не сможет удалить его или менять других кураторов.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Текущие кураторы</p>
            {isLoading && curators.length === 0 ? (
              <p className="text-muted-foreground text-sm">Загрузка…</p>
            ) : curators.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Кураторы ещё не назначены.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {curators.map((curator) => (
                  <li
                    key={curator.userId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {curator.fullName?.trim() || "Без имени"}
                      </p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {getRoleTranslation(curator.role)}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleRemove(curator.userId)}
                    >
                      Снять
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-2">
            <Label htmlFor="manage-curator-select">Добавить куратора</Label>
            <input type="hidden" {...register("courseId")} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Controller
                name="userId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={busy || assignable.length === 0}
                  >
                    <SelectTrigger
                      id="manage-curator-select"
                      className="w-full min-w-0 flex-1"
                      aria-invalid={Boolean(errors.userId)}
                    >
                      <SelectValue placeholder="Выберите пользователя" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {(candidate.fullName?.trim() || "Без имени") +
                            ` · ${getRoleTranslation(candidate.role)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="submit" disabled={busy}>
                {isSubmitting ? "Сохранение…" : "Добавить"}
              </Button>
            </div>
            {errors.userId?.message ? (
              <p className="text-destructive text-sm" role="alert">
                {errors.userId.message}
              </p>
            ) : null}
            {!isLoading && assignable.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Нет доступных пользователей для назначения.
              </p>
            ) : null}
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
