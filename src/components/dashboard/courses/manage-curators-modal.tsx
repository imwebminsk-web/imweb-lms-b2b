"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addCourseCurator,
  getAvailableCurators,
  getCourseCurators,
  removeCourseCurator,
  type CourseCurator,
  type CuratorCandidate,
} from "@/app/actions/curator-actions";
import type { Role } from "@/lib/auth/rbac";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function roleLabel(role: Role | null): string {
  if (role === "head_teacher") return "Завуч";
  if (role === "teacher") return "Преподаватель";
  if (role === "admin") return "Админ";
  return role ?? "—";
}

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
  const [isMutating, startMutateTransition] = useTransition();
  const [curators, setCurators] = useState<CourseCurator[]>([]);
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

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
    if (!isOpen) {
      setSelectedUserId("");
      return;
    }
    loadLists();
    // Загружаем только при открытии модалки и смене курса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, courseId]);

  const assignable = useMemo(() => {
    const assignedIds = new Set(curators.map((c) => c.userId));
    return candidates.filter((c) => !assignedIds.has(c.id));
  }, [candidates, curators]);

  function handleAdd() {
    if (!selectedUserId || isMutating) {
      return;
    }

    startMutateTransition(async () => {
      const result = await addCourseCurator(courseId, selectedUserId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Куратор назначен");
      setSelectedUserId("");
      loadLists();
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    if (isMutating) {
      return;
    }

    startMutateTransition(async () => {
      const result = await removeCourseCurator(courseId, userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Куратор снят");
      loadLists();
      router.refresh();
    });
  }

  const busy = isLoading || isMutating;

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
                        {roleLabel(curator.role)}
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

          <div className="space-y-2">
            <p className="text-sm font-medium">Добавить куратора</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={selectedUserId || undefined}
                onValueChange={setSelectedUserId}
                disabled={busy || assignable.length === 0}
              >
                <SelectTrigger className="w-full min-w-0 flex-1">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {(candidate.fullName?.trim() || "Без имени") +
                        ` · ${roleLabel(candidate.role)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={busy || !selectedUserId}
              >
                {isMutating ? "Сохранение…" : "Добавить"}
              </Button>
            </div>
            {!isLoading && assignable.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Нет доступных пользователей для назначения.
              </p>
            ) : null}
          </div>
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
