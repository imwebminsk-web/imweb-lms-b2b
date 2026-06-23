"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";

import { createCourse, type CreateCourseState } from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialCreateCourseState: CreateCourseState = {};

function CreateCourseDialogInner({
  onSucceeded,
}: {
  onSucceeded: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createCourse,
    initialCreateCourseState,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      onSucceeded();
      router.refresh();
    }
  }, [state.success, onSucceeded, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="default" className="w-full sm:w-auto">
          Создать курс
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый курс</DialogTitle>
          <DialogDescription>
            Курс сохранится как черновик. После сохранения списки на дашборде и в
            «Мои курсы» обновятся автоматически.
          </DialogDescription>
        </DialogHeader>
        <Form action={formAction} className="gap-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">Название</Label>
            <Input
              id="course-title"
              name="title"
              required
              maxLength={200}
              placeholder="Например, Английский для начинающих"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL курса (slug) — опционально</Label>
            <Input
              id="slug"
              name="slug"
              maxLength={120}
              placeholder="english-for-beginners"
              disabled={isPending}
            />
            <p className="text-muted-foreground text-xs">
              Оставьте пустым для автогенерации из названия. Только латинские
              буквы, цифры и дефис.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-description">Описание</Label>
            <Textarea
              id="course-description"
              name="description"
              rows={4}
              placeholder="Кратко о содержании курса"
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="course-price">Цена</Label>
            <Input
              id="course-price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              required
              disabled={isPending}
            />
          </div>
          {state.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохранение…" : "Создать"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Диалог создания курса для преподавателя/админа; после успеха сбрасывает состояние action. */
export function CreateCourseDialog() {
  const [instance, setInstance] = useState(0);
  const onSucceeded = useCallback(() => {
    setInstance((n) => n + 1);
  }, []);

  return (
    <CreateCourseDialogInner
      key={instance}
      onSucceeded={onSucceeded}
    />
  );
}
