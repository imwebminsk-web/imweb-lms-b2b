"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition, type MouseEvent } from "react";
import { toast } from "sonner";

import { sendTestToRetake } from "@/app/actions/gradebook-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SendToRetakeDialogProps = {
  attemptId: string;
  testId: string;
  studentId: string;
  lessonId?: string;
  disabled?: boolean;
  triggerSize?: "default" | "sm" | "lg";
  triggerClassName?: string;
  onSuccess: () => void;
};

const CONFIRM_TEXT =
  "Попытка и отметка о прохождении урока будут удалены безвозвратно. Ученик должен будет пройти тест заново.";

export function SendToRetakeDialog({
  attemptId,
  testId,
  studentId,
  lessonId,
  disabled = false,
  triggerSize = "sm",
  triggerClassName,
  onSuccess,
}: SendToRetakeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    startTransition(() => {
      void (async () => {
        const res = await sendTestToRetake({
          attemptId,
          testId,
          studentId,
          lessonId,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success("Тест отправлен на пересдачу");
        setOpen(false);
        onSuccess();
      })();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size={triggerSize}
          className={triggerClassName}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Сброс…
            </>
          ) : (
            "Отправить на пересдачу"
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отправить на пересдачу?</AlertDialogTitle>
          <AlertDialogDescription>{CONFIRM_TEXT}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isPending ? "Удаление…" : "Отправить на пересдачу"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
