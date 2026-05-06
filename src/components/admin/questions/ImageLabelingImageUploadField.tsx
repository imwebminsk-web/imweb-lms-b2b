"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { compressImageForTestUpload } from "@/lib/client/compress-test-image";
import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";

const BUCKET = "test-images";

type ImageLabelingImageUploadFieldProps = {
  value: string;
  onUrlChange: (url: string) => void;
  disabled?: boolean;
};

export function ImageLabelingImageUploadField({
  value,
  onUrlChange,
  disabled,
}: ImageLabelingImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || disabled) return;

    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Войдите в систему, чтобы загрузить изображение");
        setBusy(false);
        return;
      }

      const blob = await compressImageForTestUpload(file);
      const ext = blob.type.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/labeling/${crypto.randomUUID()}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: blob.type || `image/${ext}`,
        });

      if (upErr) {
        setError(upErr.message);
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!pub?.publicUrl) {
        setError("Не удалось получить публичный URL");
        return;
      }

      onUrlChange(pub.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <label className="text-muted-foreground text-xs font-medium">
        Изображение (JPEG, PNG, WebP)
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || busy}
        onChange={onFileChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {busy ? "Загрузка…" : "Выбрать файл"}
        </Button>
        {value ? (
          <span className="text-muted-foreground max-w-[200px] truncate text-xs">
            Загружено
          </span>
        ) : null}
      </div>
      {value ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-md border border-border bg-muted/20",
            busy && "opacity-50",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="mx-auto max-h-40 w-full object-contain"
          />
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
