"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCohort } from "@/app/actions/cohort-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CourseOption = { id: string; title: string };

export function CreateCohortDialog({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const disabled = courses.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !name.trim()) {
      toast.error("Выберите курс и введите название группы.");
      return;
    }
    startTransition(async () => {
      const res = await createCohort(courseId, name.trim());
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Группа создана. PIN: ${res.pinCode}`);
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" disabled={disabled} className="w-full sm:w-auto">
          Создать группу
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Новая группа</DialogTitle>
            <DialogDescription>
              Группа привязывается к курсу. Ученики смогут входить по PIN (появится
              после создания).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cohort-course">Курс</Label>
              <Select
                value={courseId || undefined}
                onValueChange={setCourseId}
                disabled={isPending || courses.length === 0}
              >
                <SelectTrigger id="cohort-course" className="w-full">
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cohort-name">Название группы</Label>
              <Input
                id="cohort-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                maxLength={200}
                placeholder="Например, Группа А — весна 2026"
                disabled={isPending}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isPending || !courseId}>
              {isPending ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
