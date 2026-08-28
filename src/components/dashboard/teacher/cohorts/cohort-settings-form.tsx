"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteCohort,
  updateCohortSettings,
} from "@/app/actions/cohort-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type CohortSettingsFormProps = {
  cohort: {
    id: string;
    name: string;
    is_chat_enabled: boolean;
    requires_approval: boolean;
  };
};

export function CohortSettingsForm({ cohort }: CohortSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(cohort.name);
  const [isChatEnabled, setIsChatEnabled] = useState(cohort.is_chat_enabled);
  const [requiresApproval, setRequiresApproval] = useState(
    cohort.requires_approval,
  );
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setName(cohort.name);
    setIsChatEnabled(cohort.is_chat_enabled);
    setRequiresApproval(cohort.requires_approval);
  }, [cohort.name, cohort.is_chat_enabled, cohort.requires_approval]);

  function handleSaveName() {
    startTransition(async () => {
      const result = await updateCohortSettings(cohort.id, { name });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Название группы сохранено");
      router.refresh();
    });
  }

  function handleChatToggle(checked: boolean) {
    setIsChatEnabled(checked);
    startTransition(async () => {
      const result = await updateCohortSettings(cohort.id, {
        is_chat_enabled: checked,
      });
      if (!result.success) {
        setIsChatEnabled(!checked);
        toast.error(result.error);
        return;
      }
      toast.success(checked ? "Чат включён" : "Чат отключён");
      router.refresh();
    });
  }

  function handleRequiresApprovalToggle(checked: boolean) {
    setRequiresApproval(checked);
    startTransition(async () => {
      const result = await updateCohortSettings(cohort.id, {
        requires_approval: checked,
      });
      if (!result.success) {
        setRequiresApproval(!checked);
        toast.error(result.error);
        return;
      }
      toast.success(
        checked
          ? "Зал ожидания включён. Новые ученики ждут вашего одобрения."
          : "Зал ожидания выключен. PIN сразу даёт доступ к курсу.",
      );
      router.refresh();
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteCohort(cohort.id);
      if (result && !result.success) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="cohort-name">Название группы</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="cohort-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              disabled={isPending || isDeletePending}
            />
            <Button
              type="button"
              onClick={handleSaveName}
              disabled={
                isPending ||
                isDeletePending ||
                name.trim() === cohort.name.trim()
              }
            >
              {isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="cohort-chat-toggle">Чат группы</Label>
            <p className="text-muted-foreground text-sm">
              При отключении ученики не смогут писать в чат. Преподаватель
              по-прежнему может отправлять сообщения.
            </p>
          </div>
          <Switch
            id="cohort-chat-toggle"
            checked={isChatEnabled}
            onCheckedChange={handleChatToggle}
            disabled={isPending || isDeletePending}
            aria-label="Включить или отключить чат группы"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="cohort-approval-toggle">Зал ожидания</Label>
            <p className="text-muted-foreground text-sm">
              Ученики присоединяются по PIN-коду только после вашего одобрения.
            </p>
          </div>
          <Switch
            id="cohort-approval-toggle"
            checked={requiresApproval}
            onCheckedChange={handleRequiresApprovalToggle}
            disabled={isPending || isDeletePending}
            aria-label="Включить или отключить зал ожидания"
          />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || isDeletePending}
            >
              Удалить группу
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие необратимо. Группа будет удалена вместе со всеми
                чатами, оценками и журналами. Ученики полностью потеряют доступ
                к этому курсу.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletePending}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeletePending}
                className={buttonVariants({ variant: "destructive" })}
              >
                {isDeletePending ? "Удаление…" : "Удалить навсегда"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
