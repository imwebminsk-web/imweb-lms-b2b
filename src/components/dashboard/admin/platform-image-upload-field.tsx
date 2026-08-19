"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "platform-assets";
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

type PlatformImageUploadFieldProps = {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (url: string) => void;
  assetKind: "logo" | "hero";
};

export function PlatformImageUploadField({
  id,
  label,
  description,
  value,
  onChange,
  assetKind,
}: PlatformImageUploadFieldProps) {
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
      const path = `branding/${assetKind}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setError(uploadError.message || "Ошибка загрузки в Storage.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      onChange(`${publicUrl}?v=${Date.now()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>

      <div
        className={cn(
          "border-border bg-muted/20 relative flex items-center justify-center overflow-hidden rounded-lg border",
          assetKind === "logo" ? "h-28" : "aspect-video w-full max-w-md",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className={cn(
              assetKind === "logo"
                ? "max-h-20 w-auto object-contain p-4"
                : "size-full object-cover",
            )}
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <ImageIcon className="size-8 opacity-50" aria-hidden />
            <span>
              {assetKind === "logo"
                ? "Логотип не загружен"
                : "Фоновое изображение не загружено"}
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={onFileChange}
        disabled={busy}
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
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <UploadIcon className="size-4" aria-hidden />
          )}
          <span className="ml-2">
            {busy ? "Загрузка..." : "Выбрать файл"}
          </span>
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={busy}
          >
            Удалить
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
