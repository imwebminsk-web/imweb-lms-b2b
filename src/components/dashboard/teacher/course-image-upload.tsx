"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { updateCourseImage } from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "course-covers";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export function CourseImageUpload({
  courseId,
  initialImageUrl,
}: {
  courseId: string;
  initialImageUrl: string | null;
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
      setError("Допустимы только JPEG, PNG, WebP или GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Файл больше 5 МБ.");
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

      const res = await updateCourseImage(courseId, publicUrl);
      if (res.error) {
        setError(res.error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const clearCover = async () => {
    if (!window.confirm("Убрать обложку курса?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateCourseImage(courseId, "");
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
        <p className="text-sm font-medium">Обложка курса</p>
        <p className="text-muted-foreground text-xs">
          Загрузка в bucket «{BUCKET}» (публичный URL сохраняется в{" "}
          <code className="bg-muted rounded px-1">image_url</code>).
        </p>
      </div>

      <div
        className={cn(
          "border-border bg-card relative flex aspect-video w-full max-w-md items-center justify-center overflow-hidden rounded-lg border",
        )}
      >
        {initialImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <ImageIcon className="size-10 opacity-50" aria-hidden />
            <span>Обложка не задана</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
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
          <span className="ml-2">Выбрать файл</span>
        </Button>
        {initialImageUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void clearCover()}
            disabled={busy}
          >
            Убрать обложку
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
