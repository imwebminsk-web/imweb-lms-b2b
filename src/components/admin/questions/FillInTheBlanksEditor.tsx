"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseFillInTheBlanks } from "@/lib/fill-in-the-blanks-parser";
import { cn } from "@/lib/utils";
import {
  FillInTheBlanksContentSchema,
  type FillInTheBlanksContent,
} from "@/lib/validations/fill-in-the-blanks-schema";
import { useEffect, useMemo, useRef, useState } from "react";

export type FillInTheBlanksEditorProps = {
  rawText: string;
  extraWords: string[];
  onRawTextChange: (value: string) => void;
  onExtraWordsChange: (words: string[]) => void;
  onFillContentChange: (content: FillInTheBlanksContent | null) => void;
};

export function FillInTheBlanksEditor({
  rawText,
  extraWords,
  onRawTextChange,
  onExtraWordsChange,
  onFillContentChange,
}: FillInTheBlanksEditorProps) {
  const [distractorInput, setDistractorInput] = useState("");
  const fillContentRef = useRef(onFillContentChange);

  useEffect(() => {
    fillContentRef.current = onFillContentChange;
  }, [onFillContentChange]);

  const parsed = useMemo(() => {
    const draft = parseFillInTheBlanks(rawText, extraWords);
    const z = FillInTheBlanksContentSchema.safeParse(draft);
    return z.success ? z.data : null;
  }, [rawText, extraWords]);

  useEffect(() => {
    fillContentRef.current(parsed);
  }, [parsed]);

  function addDistractor() {
    const t = distractorInput.trim();
    if (!t || extraWords.includes(t)) return;
    onExtraWordsChange([...extraWords, t]);
    setDistractorInput("");
  }

  function removeDistractor(word: string) {
    onExtraWordsChange(extraWords.filter((w) => w !== word));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="fitb-raw">
          Текст со скобками{" "}
          <span className="text-muted-foreground font-normal">
            (пропуски: <code className="text-xs">[слово]</code>)
          </span>
        </label>
        <textarea
          id="fitb-raw"
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
          placeholder="Например: Мама [мыла] раму."
          rows={5}
          className={cn(
            "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-lg border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm",
          )}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Дистракторы (лишние слова)</span>
        <div className="flex flex-wrap gap-2">
          <Input
            value={distractorInput}
            onChange={(e) => setDistractorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDistractor();
              }
            }}
            placeholder="Введите слово и нажмите «Добавить»"
            className="max-w-xs"
          />
          <Button type="button" variant="secondary" onClick={addDistractor}>
            Добавить
          </Button>
        </div>
        {extraWords.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {extraWords.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => removeDistractor(w)}
                className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
              >
                {w}
                <span className="text-xs" aria-hidden>
                  ×
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-border rounded-lg border bg-muted/30 p-4">
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          Предпросмотр
        </p>
        {!parsed ? (
          <p className="text-destructive text-sm">
            Проверьте текст: нужен хотя бы один непустой пропуск{" "}
            <code className="text-xs">[слово]</code>, уникальные id и слова в
            банке.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-foreground text-sm leading-relaxed">
              {parsed.segments.map((seg, i) =>
                seg.type === "text" ? (
                  <span key={i}>{seg.value}</span>
                ) : (
                  <span
                    key={seg.id}
                    className="border-primary/40 bg-primary/10 text-primary mx-0.5 inline-block min-w-[4rem] rounded border px-2 py-0.5 text-center text-xs font-medium"
                  >
                    ___ ({seg.id.slice(0, 8)}…)
                  </span>
                ),
              )}
            </p>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Банк слов (порядок как у ученика)
              </p>
              <div className="flex flex-wrap gap-2">
                {parsed.wordBank.map((w) => (
                  <span
                    key={w.id}
                    className="bg-background border-border rounded-full border px-3 py-1 text-sm"
                  >
                    {w.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
