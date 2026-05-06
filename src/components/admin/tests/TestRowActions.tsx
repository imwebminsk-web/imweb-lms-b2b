"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { resetTeacherAttemptAndRedirect } from "@/app/actions/attempt-actions";
import { deleteTest } from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Play, Trash2 } from "lucide-react";

type TestRowActionsProps = {
  testId: string;
};

export function TestRowActions({ testId }: TestRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Действия с тестом"
        >
          <MoreVertical className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => {
            handleDelete();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
