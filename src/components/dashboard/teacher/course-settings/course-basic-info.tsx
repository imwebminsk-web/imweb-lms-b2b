"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
          <Input
            id="course-edit-title"
            name="title"
            required
            maxLength={200}
            defaultValue={course.title}
            disabled={isPending}
          />
        </div>
        
        <div className={`space-y-2 ${isB2B ? "hidden" : ""}`}>
          <Label htmlFor="slug">URL курса (slug)</Label>
          <Input
            id="slug"
            name="slug"
            required={!isB2B}
            maxLength={120}
            defaultValue={course.slug}
            disabled={isPending}
            placeholder="english-for-beginners"
          />
          <p className="text-xs text-destructive">
            Внимание: изменение URL сделает старые ссылки на курс недействительными.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-edit-description">Краткое описание</Label>
          <Textarea
            id="course-edit-description"
            name="description"
            rows={4}
            defaultValue={course.description ?? ""}
            placeholder="Кратко о содержании курса"
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}
