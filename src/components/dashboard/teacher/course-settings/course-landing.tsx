"use client";

import { useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Editor } from "@/components/ui/editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  COURSE_IMAGE_MAX_BYTES,
  compressImage,
} from "@/lib/utils/image-compression";
import { uploadCourseGalleryImage } from "@/app/actions/course-actions";
import type { CourseSettingsPayload } from "@/lib/validations/course-schemas";
import { CourseVideoUpload } from "../course-video-upload";
import type { CourseSettingsFormCourse } from "../course-settings-form";

export function CourseLanding({
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
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CourseSettingsPayload>();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const promotionalImages = watch("promotional_images") ?? [];

  if (isB2B) {
    return null;
  }

  async function onGalleryFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setGalleryBusy(true);
    try {
      let count = promotionalImages.length;
      const nextImages = [...promotionalImages];
      for (const raw of files) {
        if (count >= 24) {
          toast.error("В галерее не более 24 изображений.");
          break;
        }
        try {
          const compressed = await compressImage(raw);
          if (compressed.size > COURSE_IMAGE_MAX_BYTES) {
            toast.error(
              `${raw.name}: после сжатия файл всё ещё больше 1 МБ.`,
            );
            continue;
          }
          const fd = new FormData();
          fd.append("file", compressed);
          const res = await uploadCourseGalleryImage(course.id, fd);
          if ("error" in res) {
            toast.error(res.error);
            continue;
          }
          nextImages.push(res.url);
          count += 1;
          toast.success("Изображение добавлено в галерею");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Не удалось обработать файл.",
          );
        }
      }
      setValue("promotional_images", nextImages, { shouldDirty: true });
    } finally {
      setGalleryBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Контент лендинга и медиа</h3>
        <p className="text-muted-foreground text-sm">
          Текст страницы, видео и галерея изображений.
        </p>
      </div>

      <CourseVideoUpload
        courseId={course.id}
        initialVideoUrl={course.video_url}
      />

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">Внешние площадки</h4>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="course-youtube">Ссылка YouTube</Label>
            <Controller
              name="youtube_url"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="course-youtube"
                  type="url"
                  placeholder="https://www.youtube.com/…"
                  value={field.value ?? ""}
                  disabled={isPending}
                  aria-invalid={Boolean(errors.youtube_url)}
                />
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="course-vimeo">Ссылка Vimeo</Label>
            <Controller
              name="vimeo_url"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="course-vimeo"
                  type="url"
                  placeholder="https://vimeo.com/…"
                  value={field.value ?? ""}
                  disabled={isPending}
                  aria-invalid={Boolean(errors.vimeo_url)}
                />
              )}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">Подробное описание</h4>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="course-detailed">Текст для страницы курса</Label>
          <Controller
            name="landingDescription"
            control={control}
            render={({ field }) => (
              <Editor
                id="course-detailed"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
          <p className="text-muted-foreground text-xs">
            Заголовки, списки и выделение сохраняются как HTML для
            страницы курса.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">Галерея лендинга</h4>
        </div>
        <p className="text-muted-foreground text-xs">
          До 24 изображений. Не забудьте нажать «Сохранить» внизу страницы после загрузки.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            tabIndex={-1}
            disabled={isPending || galleryBusy}
            onChange={(ev) => void onGalleryFilesChange(ev)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || galleryBusy || promotionalImages.length >= 24}
            onClick={() => galleryInputRef.current?.click()}
          >
            {galleryBusy ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlusIcon className="mr-2 size-4" aria-hidden />
            )}
            Добавить изображения
          </Button>
          <span className="text-muted-foreground text-xs">
            {promotionalImages.length} / 24
          </span>
        </div>
        {promotionalImages.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {promotionalImages.map((url) => (
              <li
                key={url}
                className="border-border group relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="size-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute right-1 top-1 shadow-sm"
                  disabled={isPending || galleryBusy}
                  aria-label="Убрать из галереи"
                  onClick={() =>
                    setValue(
                      "promotional_images",
                      promotionalImages.filter((item) => item !== url),
                      { shouldDirty: true },
                    )
                  }
                >
                  <XIcon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center text-sm">
            Пока нет изображений — добавьте через кнопку выше.
          </p>
        )}
      </div>
    </div>
  );
}
