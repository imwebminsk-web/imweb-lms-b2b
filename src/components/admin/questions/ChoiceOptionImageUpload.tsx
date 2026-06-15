"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compressImageForTestUpload } from "@/lib/client/compress-test-image";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "test-images";

type ChoiceOptionImageUploadProps = {
  value?: string;
  onUrlChange: (url: string | undefined) => void;
  disabled?: boolean;
};

export function ChoiceOptionImageUpload({
  value,
  onUrlChange,
  disabled,
}: ChoiceOptionImageUploadProps) {
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
        return;
      }

      const blob = await compressImageForTestUpload(file);
      const ext = blob.type.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/choice-options/${crypto.randomUUID()}-${Date.now()}.${ext}`;

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
    <div className="flex shrink-0 items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || busy}
        onChange={onFileChange}
      />
      {value ? (
        <div className="relative">
          <div
            className={cn(
              "size-10 overflow-hidden rounded-md border border-border bg-muted/20",
              busy && "opacity-50",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="size-full object-cover"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -top-1.5 -right-1.5 size-5 rounded-full"
            disabled={disabled || busy}
            onClick={() => onUrlChange(undefined)}
            aria-label="Удалить изображение"
          >
            <X className="size-3" aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          aria-label="Загрузить изображение для варианта"
          title="Добавить изображение"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
        </Button>
      )}
      {!value && !busy ? (
        <ImageIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      ) : null}
      {error ? (
        <span className="text-destructive sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
