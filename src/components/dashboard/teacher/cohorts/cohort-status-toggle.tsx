"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateCohortStatus } from "@/app/actions/cohort-actions";
import { Button } from "@/components/ui/button";

type CohortStatusToggleProps = {
  cohortId: string;
  isActive: boolean;
};

export function CohortStatusToggle({
  cohortId,
  isActive,
}: CohortStatusToggleProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const nextStatus = !currentStatus;
      const result = await updateCohortStatus(cohortId, nextStatus);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setCurrentStatus(result.isActive);
      toast.success(result.isActive ? "Набор открыт" : "Набор приостановлен");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleToggle} disabled={isPending}>
      {isPending
        ? "Сохранение…"
        : currentStatus
          ? "Приостановить набор"
          : "Открыть набор"}
    </Button>
  );
}
