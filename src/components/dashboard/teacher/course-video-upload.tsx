"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilmIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { updateCourseVideo } from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "course-videos";
const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = new Set(["video/mp4", "video/webm"]);

function extFromMime(mime: string): string {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  return "bin";
}

export function CourseVideoUpload({
  courseId,
  initialVideoUrl,
}: {
  courseId: string;
  initialVideoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!ALLOWED.has(file.type)) {
      setError("Допустимы только MP4 или WebM.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Файл больше 500 МБ.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Нужна авторизация.");
        return;
      }

      const ext = extFromMime(file.type);
      const path = `${user.id}/${courseId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) {
        setError(upErr.message || "Ошибка загрузки в Storage.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await updateCourseVideo(courseId, publicUrl);
      if (res.error) {
        setError(res.error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const clearVideo = async () => {
    if (!window.confirm("Удалить загруженное видео с курса?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateCourseVideo(courseId, "");
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Видео (self-hosted)</p>
        <p className="text-muted-foreground text-xs">
          Bucket «{BUCKET}», до 500 МБ. URL пишется в{" "}
          <code className="bg-muted rounded px-1">video_url</code>.
        </p>
      </div>

      <div
        className={cn(
          "border-border bg-card relative flex aspect-video w-full max-w-md items-center justify-center overflow-hidden rounded-lg border",
        )}
      >
        {initialVideoUrl ? (
          <video
            key={initialVideoUrl}
            src={initialVideoUrl}
            className="size-full object-contain"
            controls
            preload="metadata"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <FilmIcon className="size-10 opacity-50" aria-hidden />
            <span>Видео не загружено</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="sr-only"
        onChange={onFileChange}
        disabled={busy}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={pickFile}
          disabled={busy}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <UploadIcon className="size-4" aria-hidden />
          )}
          <span className="ml-2">Загрузить видео</span>
        </Button>
        {initialVideoUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void clearVideo()}
            disabled={busy}
          >
            Убрать видео
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
