"use client";

import { useRef, useState } from "react";
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
import { CourseVideoUpload } from "../course-video-upload";
import type { CourseSettingsFormCourse } from "../course-settings-form";

export function CourseLanding({
  course,
  detailedDescriptionHtml,
  setDetailedDescriptionHtml,
  promotionalImages,
  setPromotionalImages,
  isPending,
  isB2B,
}: {
  course: CourseSettingsFormCourse;
  detailedDescriptionHtml: string;
  setDetailedDescriptionHtml: (v: string) => void;
  promotionalImages: string[];
  setPromotionalImages: React.Dispatch<React.SetStateAction<string[]>>;
  isPending: boolean;
  isB2B: boolean;
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);

  if (isB2B) {
    return (
      <>
        <input type="hidden" name="detailed_description" value={detailedDescriptionHtml} />
        <input type="hidden" name="promotional_images" value={JSON.stringify(promotionalImages)} />
        <input type="hidden" name="youtube_url" value={course.youtube_url ?? ""} />
        <input type="hidden" name="vimeo_url" value={course.vimeo_url ?? ""} />
      </>
    );
  }

  async function onGalleryFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setGalleryBusy(true);
    try {
      let count = promotionalImages.length;
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
          setPromotionalImages((prev) => [...prev, res.url]);
          count += 1;
          toast.success("Изображение добавлено в галерею");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Не удалось обработать файл.",
          );
        }
      }
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

      <input type="hidden" name="detailed_description" value={detailedDescriptionHtml} />
      <input type="hidden" name="promotional_images" value={JSON.stringify(promotionalImages)} />

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
            <Input
              id="course-youtube"
              name="youtube_url"
              type="url"
              placeholder="https://www.youtube.com/…"
              defaultValue={course.youtube_url ?? ""}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="course-vimeo">Ссылка Vimeo</Label>
            <Input
              id="course-vimeo"
              name="vimeo_url"
              type="url"
              placeholder="https://vimeo.com/…"
              defaultValue={course.vimeo_url ?? ""}
              disabled={isPending}
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
          <Editor
            id="course-detailed"
            value={detailedDescriptionHtml}
            onChange={setDetailedDescriptionHtml}
            disabled={isPending}
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
                    setPromotionalImages((prev) =>
                      prev.filter((u) => u !== url),
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
