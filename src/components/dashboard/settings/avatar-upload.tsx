"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { updateProfileAvatar } from "@/app/actions/profile-actions";
import { useLanguage } from "@/components/providers/language-provider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";

const BUCKET = "avatars";
const MAX_COMPRESSED_BYTES = 150 * 1024;

type AvatarUploadProps = {
  userId: string;
  initialAvatarUrl: string | null;
  displayName: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AvatarUpload({
  userId,
  initialAvatarUrl,
  displayName,
}: AvatarUploadProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  const pickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.avatarInvalidType"));
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImage(file);

      if (compressed.size > MAX_COMPRESSED_BYTES) {
        toast.error(t("settings.avatarTooLarge"));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.id !== userId) {
        toast.error(t("settings.avatarAuthRequired"));
        return;
      }

      const objectPath = `${userId}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: compressed.type || "image/jpeg",
        });

      if (uploadError) {
        toast.error(uploadError.message || t("settings.avatarUploadFailed"));
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

      const finalUrl = `${publicUrl}?v=${Date.now()}`;

      const result = await updateProfileAvatar(finalUrl);
      if (!result.success) {
        toast.error(result.error || t("settings.avatarUploadFailed"));
        return;
      }

      setAvatarUrl(finalUrl);
      toast.success(t("settings.avatarUploadSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("settings.avatarUploadFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={pickFile}
        disabled={busy}
        className={cn(
          "group relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          busy && "pointer-events-none opacity-70",
        )}
        aria-label={t("settings.avatarUpload")}
      >
        <Avatar className="size-24 text-2xl">
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="text-lg font-semibold">
            {initialsFromName(displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="bg-background/90 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
          <UploadIcon className="text-muted-foreground size-6" aria-hidden />
        </span>
      </button>

      <div className="flex flex-col items-center gap-2 sm:items-start">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="sr-only"
          onChange={onFileChange}
          disabled={busy}
        />
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
          <span className="ml-2">{t("settings.avatarUpload")}</span>
        </Button>
        <p className="text-muted-foreground max-w-xs text-center text-xs sm:text-left">
          {t("settings.avatarHint")}
        </p>
      </div>
    </div>
  );
}
