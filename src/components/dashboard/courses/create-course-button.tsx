"use client";

import { useActionState } from "react";

import { createCourse, type CreateCourseState } from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";

const initialCreateCourseState: CreateCourseState = {};

/**
 * Одна кнопка вместо модалки: по клику создаёт черновик «Новый курс»
 * и сервер сразу перенаправляет в редактор.
 */
export function CreateCourseButton() {
  const [state, formAction, isPending] = useActionState(
    createCourse,
    initialCreateCourseState,
  );

  return (
    <form
      action={formAction}
      className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end"
    >
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Создание…" : "Создать курс"}
      </Button>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
