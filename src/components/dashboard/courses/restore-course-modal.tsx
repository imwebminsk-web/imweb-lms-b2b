"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { restoreCourse } from "@/app/actions/curriculum-actions";
import {
  getAvailableCurators,
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

function roleLabel(role: Role | null): string {
  if (role === "head_teacher") return "Завуч";
  if (role === "teacher") return "Преподаватель";
  return role ?? "—";
}

export function RestoreCourseModal({
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
  const [isPending, startRestoreTransition] = useTransition();
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedTeacherId("");
      return;
    }

    startLoadTransition(async () => {
      const result = await getAvailableCurators();
      if (result.error) {
        toast.error(result.error);
        setCandidates([]);
        return;
      }
      setCandidates(result.data ?? []);
    });
  }, [isOpen]);

  function handleRestore() {
    if (!selectedTeacherId || isPending) {
      return;
    }

    startRestoreTransition(async () => {
      const result = await restoreCourse(courseId, selectedTeacherId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Курс восстановлен");
      onClose();
      router.refresh();
    });
  }

  const busy = isLoading || isPending;

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
            Назначьте нового владельца. Курс снова появится в рабочих вкладках.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Новый владелец</p>
          <Select
            value={selectedTeacherId || undefined}
            onValueChange={setSelectedTeacherId}
            disabled={busy || candidates.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={isLoading ? "Загрузка…" : "Выберите преподавателя"}
              />
            </SelectTrigger>
            <SelectContent>
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
            disabled={busy || !selectedTeacherId}
          >
            {isPending ? "Восстановление…" : "Восстановить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
