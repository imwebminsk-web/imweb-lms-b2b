"use client";

import { ClockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type QuizTimerProps = {
  /** Лимит в минутах; 0 или меньше — таймер не показывается. */
  timeLimitMinutes: number;
  onExpire: () => void;
  disabled?: boolean;
  timeRemainingLabel?: string;
  /** Без внешней обёртки (встраивается в шапку QuizPlayer). */
  embedded?: boolean;
};

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function QuizTimer({
  timeLimitMinutes,
  onExpire,
  disabled = false,
  timeRemainingLabel = "осталось",
  embedded = false,
}: QuizTimerProps) {
  const totalSeconds = Math.max(0, Math.round(timeLimitMinutes * 60));
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    setRemainingSeconds(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (disabled || totalSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [disabled, totalSeconds]);

  if (totalSeconds <= 0) {
    return null;
  }

  const isUrgent = remainingSeconds <= 60;

  const timerBody = (
    <>
      <ClockIcon
        className={cn("size-4", isUrgent ? "text-destructive" : "text-muted-foreground")}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          isUrgent ? "text-destructive" : "text-foreground",
        )}
      >
        {formatMmSs(remainingSeconds)}
      </span>
      <span className="text-muted-foreground text-xs">{timeRemainingLabel}</span>
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2",
          isUrgent && "text-destructive",
        )}
        role="timer"
        aria-live="polite"
        aria-atomic="true"
      >
        {timerBody}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 -mx-6 mb-4 flex items-center justify-center gap-2 border-b px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-lg sm:border",
        isUrgent && "border-destructive/40 bg-destructive/5",
      )}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      {timerBody}
    </div>
  );
}
