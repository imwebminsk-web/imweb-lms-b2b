"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { restoreCourse } from "@/app/actions/curriculum-actions";
import {
  getRestoreOwnerCandidates,
  type CuratorCandidate,
} from "@/app/actions/curator-actions";
import type { Role } from "@/lib/auth/rbac";
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

const KEEP_CURRENT_OWNER_VALUE = "__keep_current_owner__";

function roleLabel(role: Role | null): string {
  if (role === "head_teacher") return "Завуч";
  if (role === "teacher") return "Преподаватель";
  if (role === "admin") return "Администратор";
  return role ?? "—";
}

export function RestoreCourseModal({
  courseId,
  currentOwnerIsActive,
  isOpen,
  onClose,
}: {
  courseId: string;
  currentOwnerIsActive: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isLoading, startLoadTransition] = useTransition();
  const [isPending, startRestoreTransition] = useTransition();
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);
  const [selectedOwnerValue, setSelectedOwnerValue] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedOwnerValue("");
      return;
    }

    if (currentOwnerIsActive) {
      setSelectedOwnerValue(KEEP_CURRENT_OWNER_VALUE);
    } else {
      setSelectedOwnerValue("");
    }

    startLoadTransition(async () => {
      const result = await getRestoreOwnerCandidates();
      if (result.error) {
        toast.error(result.error);
        setCandidates([]);
        return;
      }
      setCandidates(result.data ?? []);
    });
  }, [isOpen, currentOwnerIsActive]);

  function handleRestore() {
    if (isPending) {
      return;
    }

    const keepCurrentOwner =
      currentOwnerIsActive &&
      (selectedOwnerValue === "" ||
        selectedOwnerValue === KEEP_CURRENT_OWNER_VALUE);

    if (!keepCurrentOwner && !selectedOwnerValue) {
      return;
    }

    startRestoreTransition(async () => {
      const result = await restoreCourse(
        courseId,
        keepCurrentOwner ? undefined : selectedOwnerValue,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Курс восстановлен");
      onClose();
      router.refresh();
    });
  }

  const busy = isLoading || isPending;
  const canSubmit =
    currentOwnerIsActive ||
    Boolean(selectedOwnerValue && selectedOwnerValue !== KEEP_CURRENT_OWNER_VALUE);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Восстановить курс</DialogTitle>
          <DialogDescription>
            {currentOwnerIsActive
              ? "Курс снова появится в рабочих вкладках. Можно оставить текущего владельца или назначить нового."
              : "Назначьте нового активного владельца, чтобы восстановить курс."}
          </DialogDescription>
        </DialogHeader>

        {!currentOwnerIsActive ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Внимание: текущий создатель курса деактивирован. Для восстановления
            обязательно назначьте нового активного преподавателя.
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {currentOwnerIsActive ? "Владелец курса" : "Новый владелец"}
          </p>
          <Select
            value={selectedOwnerValue || undefined}
            onValueChange={setSelectedOwnerValue}
            disabled={busy || candidates.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  isLoading
                    ? "Загрузка…"
                    : currentOwnerIsActive
                      ? "Оставить текущего владельца"
                      : "Выберите преподавателя"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {currentOwnerIsActive ? (
                <SelectItem value={KEEP_CURRENT_OWNER_VALUE}>
                  Оставить текущего владельца
                </SelectItem>
              ) : null}
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {(candidate.fullName?.trim() || "Без имени") +
                    ` · ${roleLabel(candidate.role)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleRestore}
            disabled={busy || !canSubmit}
          >
            {isPending ? "Восстановление…" : "Восстановить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
