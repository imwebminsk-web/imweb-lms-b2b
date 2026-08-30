"use client";

import { Controller, useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseSettingsPayload } from "@/lib/validations/course-schemas";

export function CourseConditions({
  isPending,
  isB2B,
}: {
  isPending: boolean;
  isB2B: boolean;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<CourseSettingsPayload>();

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Условия и длительность</h3>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="course-duration-value">Длительность (число)</Label>
            <Controller
              name="duration"
              control={control}
              render={({ field }) => (
                <Input
                  id="course-duration-value"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Например, 8"
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? "" : event.target.value,
                    )
                  }
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={isPending}
                  aria-invalid={Boolean(errors.duration)}
                />
              )}
            />
            {errors.duration ? (
              <p className="text-destructive text-sm" role="alert">
                {errors.duration.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="course-duration-unit">Единица</Label>
            <Controller
              name="duration_unit"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "__empty__"}
                  onValueChange={(value) =>
                    field.onChange(value === "__empty__" ? "" : value)
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="course-duration-unit" className="w-full">
                    <SelectValue placeholder="Не выбрано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Не выбрано</SelectItem>
                    <SelectItem value="hours">Часов</SelectItem>
                    <SelectItem value="weeks">Недель</SelectItem>
                    <SelectItem value="months">Месяцев</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className={`grid gap-2 ${isB2B ? "hidden" : ""}`}>
          <Label htmlFor="course-start-date">Дата старта</Label>
          <Controller
            name="start_date"
            control={control}
            render={({ field }) => (
              <Input
                id="course-start-date"
                type="date"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={isPending}
                aria-invalid={Boolean(errors.start_date)}
              />
            )}
          />
          {errors.start_date ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.start_date.message}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Оставьте пустым, если дата не фиксирована.
          </p>
        </div>

        <Controller
          name="certificateEnabled"
          control={control}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="course-certificate"
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isPending}
              />
              <Label htmlFor="course-certificate" className="cursor-pointer font-normal">
                Выдаётся сертификат
              </Label>
            </div>
          )}
        />
      </div>
    </div>
  );
}
