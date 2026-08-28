"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  UserRoundCog,
} from "lucide-react";

import { resetTeacherAttemptAndRedirect } from "@/app/actions/attempt-actions";
import {
  archiveTest,
  duplicateTest,
  restoreTest,
} from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TestRowActionsProps = {
  testId: string;
  isArchived: boolean;
  canHardDelete?: boolean;
  canChangeOwner?: boolean;
  onHardDeleteRequest: () => void;
  onChangeOwnerRequest?: () => void;
};

export function TestRowActions({
  testId,
  isArchived,
  canHardDelete = false,
  canChangeOwner = false,
  onHardDeleteRequest,
  onChangeOwnerRequest,
}: TestRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateTest(testId);
      if (!res.success) {
        toast.error(`Ошибка при копировании: ${res.error}`);
        return;
      }
      toast.success("Копия теста создана");
      router.push(`/dashboard/tests/${res.testId}/edit`);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const res = await archiveTest(testId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Тест архивирован");
      router.refresh();
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreTest(testId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Тест восстановлен");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={pending}
          aria-label="Действия с тестом"
        >
          <MoreVertical className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {!isArchived ? (
          <>
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/tests/${testId}/edit`}
                className="flex cursor-pointer items-center gap-2"
              >
                <Pencil className="size-4" aria-hidden />
                Редактировать
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <form
                action={resetTeacherAttemptAndRedirect.bind(null, testId)}
                className="w-full"
              >
                <button
                  type="submit"
                  className="flex w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                >
                  <Play className="size-4 shrink-0" aria-hidden />
                  Пройти
                </button>
              </form>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={pending} onClick={handleDuplicate}>
              <Copy className="size-4" aria-hidden />
              Копировать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={pending} onClick={handleArchive}>
              <Archive className="size-4" aria-hidden />
              {pending ? "Архивирование…" : "В архив"}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem disabled={pending} onClick={handleRestore}>
              <ArchiveRestore className="size-4" aria-hidden />
              {pending ? "Восстановление…" : "Восстановить"}
            </DropdownMenuItem>
            {canChangeOwner ? (
              <DropdownMenuItem
                disabled={pending}
                onClick={() => onChangeOwnerRequest?.()}
              >
                <UserRoundCog className="size-4" aria-hidden />
                Сменить автора
              </DropdownMenuItem>
            ) : null}
            {canHardDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={onHardDeleteRequest}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Удалить навсегда
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
