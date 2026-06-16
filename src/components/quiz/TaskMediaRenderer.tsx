"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { RichTextHtml, type RichTextHtmlProps } from "@/components/quiz/RichTextHtml";
import { Button } from "@/components/ui/button";
import {
  instructionHtmlHasNativeMedia,
  splitInstructionHtmlForMediaLimiter,
  type InstructionHtmlSegment,
} from "@/lib/task-media-segments";
import { transformMediaUrlsInHtml } from "@/lib/media-utils";
import { cn } from "@/lib/utils";

export type TaskMediaRendererProps = RichTextHtmlProps & {
  /** 0 = безлимит; лимит только для `<audio>` / `<video>`, iframe игнорируются. */
  mediaPlayLimit?: number;
};

type LimitedNativeMediaProps = {
  tag: "audio" | "video";
  src: string;
  poster?: string;
  playLimit: number;
  mediaKey: string;
};

function LimitedNativeMedia({
  tag,
  src,
  poster,
  playLimit,
  mediaKey,
}: LimitedNativeMediaProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [playsLeft, setPlaysLeft] = useState(playLimit);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayClick = useCallback(async () => {
    if (playsLeft <= 0 || isPlaying || !src.trim()) return;
    const node = mediaRef.current;
    if (!node) return;

    try {
      setPlaysLeft((prev) => Math.max(0, prev - 1));
      setIsPlaying(true);
      node.currentTime = 0;
      await node.play();
    } catch {
      setIsPlaying(false);
      setPlaysLeft((prev) => prev + 1);
    }
  }, [isPlaying, playsLeft, src]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const actionLabel = tag === "video" ? "Смотреть" : "Слушать";

  return (
    <div key={mediaKey} className="my-3 flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={playsLeft <= 0 || isPlaying || !src.trim()}
        onClick={() => void handlePlayClick()}
      >
        {playsLeft > 0
          ? `▶ ${actionLabel} (Осталось попыток: ${playsLeft})`
          : "Лимит исчерпан"}
      </Button>

      {tag === "video" ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          className="hidden"
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          className="hidden"
          src={src}
          preload="metadata"
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}

function renderSegment(
  segment: InstructionHtmlSegment,
  index: number,
  playLimit: number,
  className?: string,
) {
  if (segment.kind === "html") {
    return (
      <RichTextHtml
        key={`html-${index}`}
        html={segment.html}
        className={className}
      />
    );
  }

  if (segment.kind === "iframe") {
    return (
      <div
        key={`iframe-${index}`}
        className={cn(
          "[&_iframe]:mx-auto [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-3xl [&_iframe]:rounded-lg [&_iframe]:border-0",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: segment.outerHtml }}
      />
    );
  }

  return (
    <LimitedNativeMedia
      key={`native-${index}`}
      mediaKey={`native-${index}`}
      tag={segment.tag}
      src={segment.src}
      poster={segment.poster}
      playLimit={playLimit}
    />
  );
}

export function TaskMediaRenderer({
  html,
  className,
  mediaPlayLimit = 0,
  ...rest
}: TaskMediaRendererProps) {
  const limit = Math.max(0, mediaPlayLimit);
  const shouldLimit = limit > 0 && instructionHtmlHasNativeMedia(html);

  const segments = useMemo(() => {
    if (!shouldLimit) return null;
    return splitInstructionHtmlForMediaLimiter(html);
  }, [html, shouldLimit]);

  if (!shouldLimit || !segments) {
    const embedReadyHtml = transformMediaUrlsInHtml(html);
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

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 [&_p+p]:mt-2",
        className,
      )}
    >
      {segments.map((segment, index) =>
        renderSegment(segment, index, limit, undefined),
      )}
    </div>
  );
}
