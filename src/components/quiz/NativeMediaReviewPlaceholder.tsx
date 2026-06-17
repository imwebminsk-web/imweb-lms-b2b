import { cn } from "@/lib/utils";

export const NATIVE_MEDIA_REVIEW_PLACEHOLDER_TEXT =
  "Медиафайл недоступен после завершения тестирования";

export function NativeMediaReviewPlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted/50 text-muted-foreground mb-4 block rounded-md p-4 text-sm italic",
        className,
      )}
    >
      {NATIVE_MEDIA_REVIEW_PLACEHOLDER_TEXT}
    </span>
  );
}
