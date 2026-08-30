"use client";

import { Controller, useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseSettingsPayload } from "@/lib/validations/course-schemas";

export function CoursePrice({
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

  if (isB2B) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Стоимость</h3>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="course-edit-price">Цена</Label>
        <Controller
          name="price"
          control={control}
          render={({ field }) => (
            <Input
              id="course-edit-price"
              type="number"
              min={0}
              step="0.01"
              value={field.value ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                field.onChange(raw === "" ? undefined : Number(raw));
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={isPending}
              aria-invalid={Boolean(errors.price)}
            />
          )}
        />
        {errors.price ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.price.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
