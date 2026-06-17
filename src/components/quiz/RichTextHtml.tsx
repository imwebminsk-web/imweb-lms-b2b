"use client";

import { isLikelyHtml, plainTextFromRichContent } from "@/lib/utils/rich-text-content";
import {
  QUIZ_PROSE_BASE,
  QUIZ_PROSE_EMBEDDED_IMG,
  normalizeEmbeddedImagesInHtml,
} from "@/lib/quiz-rich-text-styles";
import { parseReviewHtmlWithHiddenNativeMedia } from "@/lib/quiz-rich-text-parser";
import { cn } from "@/lib/utils";

export type RichTextHtmlProps = {
  html: string;
  className?: string;
  /** Для aria-label и подписей без HTML-разметки. */
  plainTextFallback?: string;
  isReviewMode?: boolean;
};

export function richTextPlainLabel(html: string): string {
  return plainTextFromRichContent(html) || "Вопрос";
}

export function RichTextHtml({
  html,
  className,
  isReviewMode = false,
}: RichTextHtmlProps) {
  const trimmed = html.trim();
  if (!trimmed) return null;

  if (isLikelyHtml(trimmed)) {
    const embedReadyHtml = normalizeEmbeddedImagesInHtml(trimmed);
    const proseClass = cn(
      QUIZ_PROSE_BASE,
      QUIZ_PROSE_EMBEDDED_IMG,
      !isReviewMode &&
        "[&_audio]:mx-auto [&_audio]:my-2 [&_audio]:block [&_audio]:h-10 [&_audio]:w-full [&_audio]:max-w-lg [&_video]:w-full [&_video]:max-w-3xl [&_video]:mx-auto [&_video]:rounded-lg [&_video]:my-4 [&_video]:aspect-video",
      className,
    );

    if (isReviewMode) {
      return (
        <div suppressHydrationWarning className={proseClass}>
          {parseReviewHtmlWithHiddenNativeMedia(embedReadyHtml)}
        </div>
      );
    }

    return (
      <div
        suppressHydrationWarning
        className={proseClass}
        dangerouslySetInnerHTML={{ __html: embedReadyHtml }}
      />
    );
  }

  return <span className={className}>{trimmed}</span>;
}
