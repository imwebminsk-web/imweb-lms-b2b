"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reassignCourseOwner } from "@/app/actions/curriculum-actions";
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

export function ChangeOwnerModal({
  courseId,
  currentOwnerId,
  isOpen,
  onClose,
}: {
  courseId: string;
  currentOwnerId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isLoading, startLoadTransition] = useTransition();
  const [isPending, startReassignTransition] = useTransition();
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

  const assignable = useMemo(
    () => candidates.filter((c) => c.id !== currentOwnerId),
    [candidates, currentOwnerId],
  );

  function handleSubmit() {
    if (!selectedTeacherId || isPending) {
      return;
    }

    startReassignTransition(async () => {
      const result = await reassignCourseOwner(courseId, selectedTeacherId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Владелец курса изменён");
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
          <DialogTitle>Сменить владельца</DialogTitle>
          <DialogDescription>
            Курс останется активным. Новый владелец получит полные права на него.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Новый владелец</p>
          <Select
            value={selectedTeacherId || undefined}
            onValueChange={setSelectedTeacherId}
            disabled={busy || assignable.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={isLoading ? "Загрузка…" : "Выберите преподавателя"}
              />
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !selectedTeacherId}
          >
            {isPending ? "Сохранение…" : "Сменить владельца"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
