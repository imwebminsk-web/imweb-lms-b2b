"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RichTextHtml, type RichTextHtmlProps } from "@/components/quiz/RichTextHtml";
import { NativeMediaReviewPlaceholder } from "@/components/quiz/NativeMediaReviewPlaceholder";
import { Button } from "@/components/ui/button";
import {
  instructionHtmlHasNativeMedia,
  splitInstructionHtmlForMediaLimiter,
  type InstructionHtmlSegment,
} from "@/lib/task-media-segments";
import { transformMediaUrlsInHtml } from "@/lib/media-utils";
import {
  QUIZ_PROSE_BASE,
  QUIZ_PROSE_EMBEDDED_IMG,
} from "@/lib/quiz-rich-text-styles";
import { cn } from "@/lib/utils";

export type TaskMediaRendererProps = RichTextHtmlProps & {
  /** 0 = безлимит; лимит только для `<audio>` / `<video>`, iframe игнорируются. */
  mediaPlayLimit?: number;
  isReviewMode?: boolean;
};

type LimitedNativeMediaProps = {
  tag: "audio" | "video";
  src: string;
  poster?: string;
  playLimit: number;
  mediaKey: string;
  isReviewMode?: boolean;
};

function LimitedMediaReviewPlaceholder() {
  return <NativeMediaReviewPlaceholder className="my-4" />;
}

function LimitedNativeMedia({
  tag,
  src,
  poster,
  playLimit,
  mediaKey,
  isReviewMode = false,
}: LimitedNativeMediaProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [playsLeft, setPlaysLeft] = useState(playLimit);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoPlayRequested, setVideoPlayRequested] = useState(false);
  const [audioSessionActive, setAudioSessionActive] = useState(false);

  const handlePlayClick = useCallback(() => {
    if (
      playsLeft <= 0 ||
      isPlaying ||
      showVideo ||
      audioSessionActive ||
      !src.trim()
    ) {
      return;
    }

    setPlaysLeft((prev) => Math.max(0, prev - 1));
    setIsPlaying(true);
    setIsPaused(false);

    if (tag === "video") {
      setShowVideo(true);
      setVideoPlayRequested(true);
      return;
    }

    const node = mediaRef.current;
    if (!node) {
      setIsPlaying(false);
      setPlaysLeft((prev) => prev + 1);
      return;
    }

    setAudioSessionActive(true);
    node.currentTime = 0;
    void node.play().catch(() => {
      setIsPlaying(false);
      setAudioSessionActive(false);
      setPlaysLeft((prev) => prev + 1);
    });
  }, [audioSessionActive, isPlaying, playsLeft, showVideo, src, tag]);

  useEffect(() => {
    if (!videoPlayRequested || tag !== "video") return;
    const node = mediaRef.current;
    if (!node) return;

    setVideoPlayRequested(false);
    node.currentTime = 0;
    void node.play().catch(() => {
      setIsPlaying(false);
      setIsPaused(false);
      setShowVideo(false);
      setPlaysLeft((prev) => prev + 1);
    });
  }, [videoPlayRequested, tag]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setAudioSessionActive(false);
    if (tag === "video") {
      setShowVideo(false);
    }
  }, [tag]);

  const handleMediaPlay = useCallback(() => {
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const handleMediaPause = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const handleTogglePause = useCallback(() => {
    const node = mediaRef.current;
    if (!node) return;
    if (isPaused) {
      void node.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }
    node.pause();
  }, [isPaused]);

  const mediaSessionActive =
    tag === "video" ? showVideo : audioSessionActive;
  const showCustomControls = mediaSessionActive;

  const actionLabel = tag === "video" ? "Смотреть" : "Слушать";

  if (isReviewMode && playLimit > 0) {
    return (
      <span key={mediaKey} className="my-4 block w-full max-w-3xl">
        <LimitedMediaReviewPlaceholder />
      </span>
    );
  }

  return (
    <span
      key={mediaKey}
      className={cn(
        "my-4 block w-full max-w-3xl",
      )}
    >
      <span className="flex w-full flex-col gap-3">
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full gap-2 px-6 py-6 text-base"
          disabled={
            playsLeft <= 0 || mediaSessionActive || !src.trim()
          }
          onClick={() => void handlePlayClick()}
        >
          <Play className="size-5 shrink-0 fill-current" aria-hidden />
          {playsLeft > 0
            ? `${actionLabel} (осталось попыток: ${playsLeft})`
            : "Лимит исчерпан"}
        </Button>

        {tag === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            className={cn(
              "w-full rounded-lg bg-black object-contain",
              showVideo ? "aspect-video" : "hidden",
            )}
            src={src}
            poster={poster}
            preload="metadata"
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            onEnded={handleEnded}
            onPlay={handleMediaPlay}
            onPause={handleMediaPause}
          />
        ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            className="hidden"
            src={src}
            preload="metadata"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={handleEnded}
            onPlay={handleMediaPlay}
            onPause={handleMediaPause}
          />
        )}

        {showCustomControls ? (
          <div className="mt-2 flex items-center justify-center rounded-md bg-slate-100 p-2 dark:bg-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleTogglePause}
            >
              {isPaused ? (
                <Play className="mr-2 h-4 w-4" aria-hidden />
              ) : (
                <Pause className="mr-2 h-4 w-4" aria-hidden />
              )}
              {isPaused ? "Продолжить" : "Пауза"}
            </Button>
          </div>
        ) : null}
      </span>
    </span>
  );
}

function renderSegment(
  segment: InstructionHtmlSegment,
  index: number,
  playLimit: number,
  isReviewMode: boolean,
  className?: string,
) {
  if (segment.kind === "html") {
    return (
      <RichTextHtml
        key={`html-${index}`}
        html={segment.html}
        className={className}
        isReviewMode={isReviewMode}
      />
    );
  }

  if (segment.kind === "iframe") {
    return (
      <span
        key={`iframe-${index}`}
        className={cn(
          "block [&_iframe]:mx-auto [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-3xl [&_iframe]:rounded-lg [&_iframe]:border-0",
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
      isReviewMode={isReviewMode}
    />
  );
}

export function TaskMediaRenderer({
  html,
  className,
  mediaPlayLimit = 0,
  isReviewMode = false,
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
        isReviewMode={isReviewMode}
        className={cn(
          !isReviewMode &&
            "[&_iframe]:mx-auto [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-3xl [&_iframe]:rounded-lg [&_iframe]:border-0",
          className,
        )}
      />
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={cn(
        QUIZ_PROSE_BASE,
        QUIZ_PROSE_EMBEDDED_IMG,
        className,
      )}
    >
      {segments.map((segment, index) =>
        renderSegment(segment, index, limit, isReviewMode, undefined),
      )}
    </div>
  );
}
