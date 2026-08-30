"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import {
  updateBlock,
  uploadBlockImage,
} from "@/app/actions/lesson-block-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function LessonBlockImageUpload({
  lessonId,
  blockId,
  imageUrl,
}: {
  lessonId: string;
  blockId: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearPending, startClearTransition] = useTransition();

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

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("blockId", blockId);

      const res = await uploadBlockImage(lessonId, formData);
      if (!res.ok) {
        toast.error(res.error);
        setError(res.error);
        return;
      }

      toast.success("Изображение загружено");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  };

  function handleClearImageConfirm() {
    startClearTransition(async () => {
      setError(null);
      const res = await updateBlock(blockId, {});
      if (!res.ok) {
        toast.error(res.error);
        setError(res.error);
        return;
      }
      toast.success("Изображение убрано");
      setConfirmClearOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Изображение</p>
        <p className="text-muted-foreground text-xs">
          Максимальный размер: 5 МБ. Форматы: JPG, PNG, WebP.
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
              disabled={isUploading}
            >
              {isUploading ? (
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
              onClick={() => setConfirmClearOpen(true)}
              disabled={isUploading || isClearPending}
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
          disabled={isUploading}
        >
          {isUploading ? (
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

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить изображение из блока?</AlertDialogTitle>
            <AlertDialogDescription>
              Картинка пропадёт из урока. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearImageConfirm}
              disabled={isClearPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isClearPending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
