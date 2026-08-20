"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseSettingsFormCourse } from "../course-settings-form";

export function CoursePrice({
  course,
  isPending,
  isB2B,
}: {
  course: CourseSettingsFormCourse;
  isPending: boolean;
  isB2B: boolean;
}) {
  if (isB2B) {
    return <input type="hidden" name="price" value={course.price} />;
  }

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Стоимость</h3>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="course-edit-price">Цена</Label>
        <Input
          id="course-edit-price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={Number(course.price)}
          disabled={isPending}
        />
      </div>
    </div>
  );
}
