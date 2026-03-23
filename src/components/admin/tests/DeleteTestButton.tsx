"use client";

import { deleteTest } from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type DeleteTestButtonProps = {
  testId: string;
};

export function DeleteTestButton({ testId }: DeleteTestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Вы уверены, что хотите удалить этот тест? Это действие необратимо.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTest(testId);
      if (!res.success) {
        window.alert(`Ошибка при удалении: ${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="icon-sm"
      disabled={isPending}
      onClick={handleClick}
      aria-label={isPending ? "Удаление…" : "Удалить тест"}
      title="Удалить тест"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-3.5" aria-hidden />
      )}
      <span className="sr-only">
        {isPending ? "Удаление…" : "Удалить тест"}
      </span>
    </Button>
  );
}
