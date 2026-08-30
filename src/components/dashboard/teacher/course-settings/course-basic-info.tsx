"use client";

import { Controller, useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseSettingsPayload } from "@/lib/validations/course-schemas";
import { CourseImageUpload } from "../course-image-upload";
import type { CourseSettingsFormCourse } from "../course-settings-form";

export function CourseBasicInfo({
  course,
  isPending,
  isB2B,
}: {
  course: CourseSettingsFormCourse;
  isPending: boolean;
  isB2B: boolean;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<CourseSettingsPayload>();

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Основная информация</h3>
      </div>

      <CourseImageUpload
        courseId={course.id}
        initialImageUrl={course.image_url}
      />

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="course-edit-title">Название</Label>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="course-edit-title"
                maxLength={200}
                disabled={isPending}
                aria-invalid={Boolean(errors.title)}
              />
            )}
          />
          {errors.title ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.title.message}
            </p>
          ) : null}
        </div>

        <div className={`space-y-2 ${isB2B ? "hidden" : ""}`}>
          <Label htmlFor="slug">URL курса (slug)</Label>
          <Controller
            name="slug"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="slug"
                maxLength={120}
                disabled={isPending}
                placeholder="english-for-beginners"
                aria-invalid={Boolean(errors.slug)}
              />
            )}
          />
          {errors.slug ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.slug.message}
            </p>
          ) : null}
          <p className="text-xs text-destructive">
            Внимание: изменение URL сделает старые ссылки на курс недействительными.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-edit-description">Краткое описание</Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                id="course-edit-description"
                rows={4}
                value={field.value ?? ""}
                placeholder="Кратко о содержании курса"
                disabled={isPending}
                aria-invalid={Boolean(errors.description)}
              />
            )}
          />
          {errors.description ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.description.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
