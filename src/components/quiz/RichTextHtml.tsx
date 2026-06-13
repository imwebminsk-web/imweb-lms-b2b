"use client";

import { isLikelyHtml, plainTextFromRichContent } from "@/lib/utils/rich-text-content";
import { cn } from "@/lib/utils";

export type RichTextHtmlProps = {
  html: string;
  className?: string;
  /** Для aria-label и подписей без HTML-разметки. */
  plainTextFallback?: string;
};

export function richTextPlainLabel(html: string): string {
  return plainTextFromRichContent(html) || "Вопрос";
}

export function RichTextHtml({ html, className }: RichTextHtmlProps) {
  const trimmed = html.trim();
  if (!trimmed) return null;

  if (isLikelyHtml(trimmed)) {
    return (
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 [&_p+p]:mt-2 [&_audio]:mx-auto [&_audio]:my-2 [&_audio]:block [&_audio]:h-10 [&_audio]:w-full [&_audio]:max-w-lg [&_video]:w-full [&_video]:max-w-3xl [&_video]:mx-auto [&_video]:rounded-lg [&_video]:my-4 [&_video]:aspect-video",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }

  return <span className={className}>{trimmed}</span>;
}
