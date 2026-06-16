"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import type { Json } from "@/types/database.types";
import { cn } from "@/lib/utils";

function puzzlePartText(content: Json, side: "left" | "right"): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { left?: unknown; right?: unknown })[side];
    if (typeof v === "string") return v.replace(/<[^>]+>/g, "").trim() || "—";
  }
  return "—";
}

function extractImageUrlFromPart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  const imgMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch?.[1]?.trim() ?? null;
}

function puzzlePartImageUrl(content: Json, side: "left" | "right"): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const rec = content as Record<string, unknown>;
  const sideValue = rec[side];
  const direct =
    typeof rec[`${side}ImageUrl`] === "string"
      ? String(rec[`${side}ImageUrl`]).trim()
      : typeof rec.imageUrl === "string"
        ? String(rec.imageUrl).trim()
        : "";
  if (direct) return direct;
  return extractImageUrlFromPart(sideValue);
}

function PuzzlePartDisplay({
  content,
  side,
  emphasize,
}: {
  content: Json;
  side: "left" | "right";
  emphasize?: boolean;
}) {
  const imageUrl = puzzlePartImageUrl(content, side);
  const text = puzzlePartText(content, side);

  if (imageUrl) {
    return (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="aspect-square w-24 overflow-hidden rounded-md bg-slate-50 dark:bg-slate-900/50 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="size-full object-contain" />
        </div>
        {text !== "—" ? (
          <span className={cn("text-xs leading-snug", emphasize && "font-medium")}>
            {text}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span className={cn("min-w-0 break-words", emphasize && "font-medium")}>
      {text}
    </span>
  );
}

export type ReviewPuzzlePairCardProps = {
  isCorrect: boolean;
  leftContent: Json;
  userRightContent: Json | null;
  correctRightContent: Json | null;
  className?: string;
};

export function ReviewPuzzlePairCard({
  isCorrect,
  leftContent,
  userRightContent,
  correctRightContent,
  className,
}: ReviewPuzzlePairCardProps) {
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/50 p-2 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PuzzlePartDisplay content={leftContent} side="left" emphasize />
        <span className="text-muted-foreground shrink-0">—</span>
        {userRightContent ? (
          <PuzzlePartDisplay content={userRightContent} side="right" />
        ) : (
          <span className="text-muted-foreground">{t("quizResult.puzzleNoAnswer")}</span>
        )}
        <Badge
          variant={isCorrect ? "secondary" : "destructive"}
          className={cn(
            "ml-auto shrink-0",
            isCorrect &&
              "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {isCorrect ? t("quizResult.correct") : t("quizResult.incorrect")}
        </Badge>
      </div>
      {!isCorrect && correctRightContent ? (
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span>{t("quizResult.puzzleCorrectAnswer")}:</span>
          <PuzzlePartDisplay content={correctRightContent} side="right" />
        </div>
      ) : null}
    </div>
  );
}
