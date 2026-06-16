"use client";

import { useMemo } from "react";

import { RichTextHtml, type RichTextHtmlProps } from "@/components/quiz/RichTextHtml";
import { transformMediaUrlsInHtml } from "@/lib/media-utils";
import { cn } from "@/lib/utils";

export type TaskMediaRendererProps = RichTextHtmlProps;

export function TaskMediaRenderer({
  html,
  className,
  ...rest
}: TaskMediaRendererProps) {
  const embedReadyHtml = useMemo(
    () => transformMediaUrlsInHtml(html),
    [html],
  );

  return (
    <RichTextHtml
      {...rest}
      html={embedReadyHtml}
      className={cn(
        "[&_iframe]:mx-auto [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-3xl [&_iframe]:rounded-lg [&_iframe]:border-0",
        className,
      )}
    />
  );
}
