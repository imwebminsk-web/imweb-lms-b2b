"use client";

import { Fragment, type ReactNode } from "react";

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function formatPair(pair: unknown): string | null {
  if (!pair || typeof pair !== "object" || Array.isArray(pair)) return null;
  const p = pair as Record<string, unknown>;
  const left = p.left ?? p.from ?? p.a ?? p.source;
  const right = p.right ?? p.to ?? p.b ?? p.target;
  if (left != null && right != null) {
    return `${String(left)} → ${String(right)}`;
  }
  return null;
}

function StructuredValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}): ReactNode {
  if (depth > 12) {
    return <span className="break-all text-xs">{String(value)}</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return <span className="break-words text-sm">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground text-sm">(пусто)</span>;
    }
    const pairStrings = value.map((item) => formatPair(item)).filter(Boolean);
    if (pairStrings.length === value.length) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {pairStrings.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="list-decimal space-y-2 pl-5 text-sm">
        {value.map((item, i) => (
          <li key={i}>
            <StructuredValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.matchingPairs)) {
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            Сопоставления
          </p>
          <StructuredValue value={o.matchingPairs} depth={depth + 1} />
        </div>
      );
    }
    const entries = Object.entries(o);
    if (entries.length === 0) {
      return <span className="text-muted-foreground text-sm">{"{}"}</span>;
    }
    return (
      <dl className="grid gap-x-2 gap-y-2 text-sm sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-muted-foreground break-all font-medium">{k}</dt>
            <dd className="min-w-0">
              <StructuredValue value={v} depth={depth + 1} />
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  }
  return <span className="text-xs">{String(value)}</span>;
}

function PrettyJsonFallback(value: unknown): ReactNode {
  try {
    const text = JSON.stringify(value, null, 2);
    return (
      <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </pre>
    );
  } catch {
    return (
      <pre className="bg-muted/50 max-h-48 overflow-auto rounded-md border p-3 text-xs break-all">
        {String(value)}
      </pre>
    );
  }
}

function LineBlock({ line }: { line: string }): ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parsed = tryParseJson(trimmed);
  if (!parsed.ok) {
    return (
      <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2 font-mono text-xs whitespace-pre-wrap break-words">
        {trimmed}
      </pre>
    );
  }
  try {
    if (typeof parsed.value === "object" && parsed.value !== null) {
      return <StructuredValue value={parsed.value} />;
    }
    return <StructuredValue value={parsed.value} />;
  } catch {
    return PrettyJsonFallback(parsed.value);
  }
}

/**
 * Читабельный вывод сохранённого ответа (JSON-строки из журнала попытки).
 */
export function AttemptAnswerSummary({ summary }: { summary: string }) {
  const trimmed = summary.trim();
  if (!trimmed) return null;

  const whole = tryParseJson(trimmed);
  if (
    whole.ok &&
    whole.value !== null &&
    (typeof whole.value === "object" || Array.isArray(whole.value))
  ) {
    try {
      return (
        <div className="rounded-md border bg-muted/30 p-3">
          <StructuredValue value={whole.value} />
        </div>
      );
    } catch {
      return PrettyJsonFallback(whole.value);
    }
  }

  const lines = summary.split("\n");
  if (lines.length <= 1) {
    return <LineBlock line={trimmed} />;
  }

  return (
    <div className="space-y-3">
      {lines.map((line, i) => (
        <div key={i} className="rounded-md border bg-muted/20 p-2">
          <LineBlock line={line} />
        </div>
      ))}
    </div>
  );
}
