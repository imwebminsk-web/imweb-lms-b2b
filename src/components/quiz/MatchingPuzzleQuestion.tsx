"use client";

import type { SafeTestOption } from "@/app/actions/test-actions";
import { Button } from "@/components/ui/button";
import type { Json } from "@/types/database.types";
import { CheckCircle2, Link2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type MatchingPair = {
  leftOptionId: string;
  rightOptionId: string;
};

function labelLeft(content: Json): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { left?: unknown }).left;
    if (typeof v === "string") return v;
  }
  return "—";
}

function labelRight(content: Json): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const v = (content as { right?: unknown }).right;
    if (typeof v === "string") return v;
  }
  return "—";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type MatchingPuzzleQuestionProps = {
  options: SafeTestOption[];
  pairs: MatchingPair[];
  onPairsChange: (pairs: MatchingPair[]) => void;
};

export function MatchingPuzzleQuestion({
  options,
  pairs,
  onPairsChange,
}: MatchingPuzzleQuestionProps) {
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const leftColumn = useMemo(
    () =>
      [...options]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o) => ({
          optionId: o.id,
          label: labelLeft(o.content),
        })),
    [options],
  );

  /** Детерминированный порядок для SSR и первого кадра на клиенте (без гидрационного расхождения). */
  const rightColumnOrdered = useMemo(
    () =>
      [...options]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o) => ({
          optionId: o.id,
          label: labelRight(o.content),
        })),
    [options],
  );

  const rightColumn = useMemo(
    () =>
      isMounted ? shuffle([...rightColumnOrdered]) : rightColumnOrdered,
    [isMounted, rightColumnOrdered],
  );

  const pairedLeft = new Set(pairs.map((p) => p.leftOptionId));
  const pairedRight = new Set(pairs.map((p) => p.rightOptionId));

  function removePair(leftOptionId: string) {
    onPairsChange(pairs.filter((p) => p.leftOptionId !== leftOptionId));
    if (activeLeftId === leftOptionId) {
      setActiveLeftId(null);
    }
  }

  function onLeftClick(optionId: string) {
    if (pairedLeft.has(optionId)) {
      removePair(optionId);
      return;
    }
    setActiveLeftId((cur) => (cur === optionId ? null : optionId));
  }

  function onRightClick(rightOptionId: string) {
    if (pairedRight.has(rightOptionId)) {
      const existing = pairs.find((p) => p.rightOptionId === rightOptionId);
      if (existing) {
        removePair(existing.leftOptionId);
      }
      return;
    }
    if (!activeLeftId) {
      return;
    }
    const next = pairs.filter(
      (p) =>
        p.leftOptionId !== activeLeftId && p.rightOptionId !== rightOptionId,
    );
    next.push({ leftOptionId: activeLeftId, rightOptionId });
    onPairsChange(next);
    setActiveLeftId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Сначала выберите элемент слева, затем кликните по элементу справа.
        Нажмите на готовую пару ниже, чтобы убрать сопоставление.
      </p>

      <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Link2 className="size-3.5" aria-hidden />
            Левая колонка
          </div>
          <ul className="flex flex-col gap-2">
            {leftColumn.map((item) => {
              const done = pairedLeft.has(item.optionId);
              const active = activeLeftId === item.optionId && !done;
              return (
                <li key={`L-${item.optionId}`}>
                  <button
                    type="button"
                    onClick={() => onLeftClick(item.optionId)}
                    className={
                      "border-input flex min-h-11 w-full items-center gap-2 rounded-xl border bg-card px-3 py-3 text-left text-base transition-colors md:min-h-12 md:text-lg " +
                      (done
                        ? "bg-muted/50 text-muted-foreground line-through opacity-70"
                        : active
                          ? "border-primary bg-primary/15 ring-primary/30 ring-2"
                          : "hover:bg-muted/50")
                    }
                  >
                    {done ? (
                      <CheckCircle2
                        className="text-primary size-5 shrink-0"
                        aria-hidden
                      />
                    ) : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Link2 className="size-3.5" aria-hidden />
            Правая колонка
          </div>
          <ul className="flex flex-col gap-2">
            {rightColumn.map((item) => {
              const done = pairedRight.has(item.optionId);
              return (
                <li key={`R-${item.optionId}`}>
                  <button
                    type="button"
                    onClick={() => onRightClick(item.optionId)}
                    disabled={!activeLeftId && !done}
                    className={
                      "border-input flex min-h-11 w-full items-center gap-2 rounded-xl border bg-card px-3 py-3 text-left text-base transition-colors md:min-h-12 md:text-lg " +
                      (done
                        ? "bg-muted/50 text-muted-foreground line-through opacity-70"
                        : !activeLeftId
                          ? "cursor-not-allowed opacity-60"
                          : "hover:bg-muted/50")
                    }
                  >
                    {done ? (
                      <CheckCircle2
                        className="text-primary size-5 shrink-0"
                        aria-hidden
                      />
                    ) : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {pairs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Составленные пары</p>
          <ul className="flex flex-col gap-2">
            {pairs.map((p) => (
              <li
                key={`${p.leftOptionId}-${p.rightOptionId}`}
                className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {labelLeft(
                      options.find((o) => o.id === p.leftOptionId)?.content ??
                        null,
                    )}
                  </span>
                  <span className="text-muted-foreground mx-2">↔</span>
                  <span className="font-medium">
                    {labelRight(
                      options.find((o) => o.id === p.rightOptionId)?.content ??
                        null,
                    )}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => removePair(p.leftOptionId)}
                  aria-label="Убрать пару"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
