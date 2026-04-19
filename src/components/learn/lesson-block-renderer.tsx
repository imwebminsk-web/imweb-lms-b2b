"use client";

import { youtubeEmbedSrc } from "@/lib/learn/youtube-embed";
import { vimeoEmbedSrc } from "@/lib/learn/vimeo-embed";
import type { Database, Json } from "@/types/database.types";

export type PlayerBlockRow = {
  id: string;
  type: Database["public"]["Enums"]["lesson_block_type"];
  content: Json;
  order_index: number;
};

function readHtml(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  if (typeof c.html === "string") return c.html;
  if (typeof c.body === "string") return c.body;
  return "";
}

function readUrl(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.url === "string" ? c.url.trim() : "";
}

function readImageUrl(content: Json): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const c = content as Record<string, unknown>;
  const u = c.imageUrl;
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

function readInstructions(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.instructions === "string" ? c.instructions.trim() : "";
}

function readTestId(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.test_id === "string" ? c.test_id.trim() : "";
}

export function LessonBlockRenderer({ block }: { block: PlayerBlockRow }) {
  switch (block.type) {
    case "text": {
      const html = readHtml(block.content);
      if (!html) {
        return (
          <p className="text-muted-foreground text-sm">Пустой текстовый блок.</p>
        );
      }
      return (
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "image": {
      const src = readImageUrl(block.content);
      if (!src) {
        return (
          <p className="text-muted-foreground text-sm">Изображение не задано.</p>
        );
      }
      return (
        <div className="overflow-hidden rounded-xl border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="mx-auto max-h-[480px] w-full object-contain" />
        </div>
      );
    }
    case "youtube": {
      const url = readUrl(block.content);
      const embed = youtubeEmbedSrc(url);
      if (embed) {
        return (
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
            <iframe
              title="Видео YouTube"
              src={embed}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }
      if (url) {
        return (
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
            <video controls className="size-full" src={url} />
          </div>
        );
      }
      return (
        <p className="text-muted-foreground text-sm">Ссылка YouTube не указана.</p>
      );
    }
    case "vimeo": {
      const url = readUrl(block.content);
      const embed = vimeoEmbedSrc(url);
      if (embed) {
        return (
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
            <iframe
              title="Видео Vimeo"
              src={embed}
              className="size-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
      return (
        <p className="text-muted-foreground text-sm">Ссылка Vimeo не указана.</p>
      );
    }
    case "assignment": {
      const text = readInstructions(block.content);
      if (!text) {
        return (
          <p className="text-muted-foreground text-sm">Задание без текста.</p>
        );
      }
      return (
        <section className="rounded-xl border bg-card/40 p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Задание
          </h3>
          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
          </div>
        </section>
      );
    }
    case "quiz": {
      const testId = readTestId(block.content);
      if (!testId) {
        return (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Тест для этого блока ещё не выбран.
          </p>
        );
      }
      return (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm leading-relaxed">
          Тестирование скоро появится
          <span className="mt-2 block font-mono text-xs opacity-70">
            test_id: {testId}
          </span>
        </p>
      );
    }
    default: {
      const _e: never = block.type;
      return _e;
    }
  }
}
