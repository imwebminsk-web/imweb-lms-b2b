"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { updateBlock } from "@/app/actions/lesson-block-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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

export function LessonBlockImageUpload({
  blockId,
  imageUrl,
}: {
  blockId: string;
  imageUrl: string | null;
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
      const path = `${user.id}/lesson-blocks/${blockId}/${crypto.randomUUID()}.${ext}`;

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

      const res = await updateBlock(blockId, { imageUrl: publicUrl });
      if (res.error) {
        setError(res.error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const clearImage = async () => {
    if (!window.confirm("Удалить изображение из блока?")) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const url = imageUrl?.trim();
      if (url) {
        const marker = `/object/public/${BUCKET}/`;
        const idx = url.indexOf(marker);
        if (idx !== -1) {
          const objectPath = decodeURIComponent(
            url.slice(idx + marker.length),
          );
          await supabase.storage.from(BUCKET).remove([objectPath]);
        }
      }
      const res = await updateBlock(blockId, {});
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
        <p className="text-sm font-medium">Изображение</p>
        <p className="text-muted-foreground text-xs">
          Bucket «{BUCKET}», до 5 МБ. Путь: ваш_id/lesson-blocks/{blockId.slice(0, 8)}…
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={Array.from(ALLOWED).join(",")}
        className="hidden"
        onChange={onFileChange}
      />
      {imageUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Блок изображения"
            className="max-h-48 w-auto rounded-md border object-contain"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pickFile}
              disabled={busy}
            >
              {busy ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
              Заменить
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void clearImage()}
              disabled={busy}
            >
              Убрать
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={pickFile}
          disabled={busy}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <ImageIcon className="size-4" />
          )}
          Загрузить изображение
        </Button>
      )}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
