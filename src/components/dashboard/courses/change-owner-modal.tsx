"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { reassignCourseOwner } from "@/app/actions/curriculum-actions";
import {
  getAvailableCurators,
  type CuratorCandidate,
} from "@/app/actions/curator-actions";
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
  changeOwnerSchema,
  type ChangeOwnerPayload,
} from "@/lib/validations/course-schemas";

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
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeOwnerPayload>({
    resolver: zodResolver(changeOwnerSchema),
    defaultValues: {
      courseId,
      newOwnerId: "",
    },
  });

  useEffect(() => {
    reset({ courseId, newOwnerId: "" });

    if (!isOpen) {
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
  }, [isOpen, courseId, reset]);

  const assignable = useMemo(
    () => candidates.filter((c) => c.id !== currentOwnerId),
    [candidates, currentOwnerId],
  );

  async function onSubmit(values: ChangeOwnerPayload) {
    const result = await reassignCourseOwner(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Владелец курса изменён");
    onClose();
    router.refresh();
  }

  const busy = isLoading || isSubmitting;

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
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Сменить владельца</DialogTitle>
            <DialogDescription>
              Курс останется активным. Новый владелец получит полные права на него.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" {...register("courseId")} />

          <div className="space-y-2 py-4">
            <Label htmlFor="change-owner-select">Новый владелец</Label>
            <Controller
              name="newOwnerId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={busy || assignable.length === 0}
                >
                  <SelectTrigger
                    id="change-owner-select"
                    className="w-full"
                    aria-invalid={Boolean(errors.newOwnerId)}
                  >
                    <SelectValue
                      placeholder={
                        isLoading ? "Загрузка…" : "Выберите преподавателя"
                      }
                    />
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
            {errors.newOwnerId?.message ? (
              <p className="text-destructive text-sm" role="alert">
                {errors.newOwnerId.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={busy}>
              {isSubmitting ? "Сохранение…" : "Сменить владельца"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
