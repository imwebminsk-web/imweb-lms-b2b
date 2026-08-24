"use client";

import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import { useId, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Loader2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
  Music,
  Film,
  Youtube as YoutubeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";

type FormatToggleProps = {
  pressed: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * preventDefault на mousedown не даёт кнопке забрать фокус у редактора.
 * Иначе выделение текста сбрасывается, и команды применяются не туда.
 */
function FormatToggle({
  pressed,
  disabled,
  label,
  title,
  onToggle,
  children,
}: FormatToggleProps) {
  return (
    <Toggle
      type="button"
      size="sm"
      variant="outline"
      pressed={pressed}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      onMouseDown={(event) => event.preventDefault()}
      onPressedChange={() => onToggle()}
    >
      {children}
    </Toggle>
  );
}

type EditorSelection = { from: number; to: number };

function snapshotSelection(editor: Editor): EditorSelection {
  return {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  };
}

function restoreSelection(editor: Editor, selection: EditorSelection | null) {
  if (!selection) return;
  const size = editor.state.doc.content.size;
  const from = Math.max(0, Math.min(selection.from, size));
  const to = Math.max(0, Math.min(selection.to, size));
  editor.commands.setTextSelection({ from, to });
}

/**
 * Списки и цитата в TipTap оборачивают весь диапазон выделения.
 * Если выделение — весь документ (from=0…конец), «Цитата» превращает
 * все абзацы в одну цитату. Сжимаем до текущего абзаца / заголовка.
 */
function runOnActiveBlock(editor: Editor, command: () => boolean) {
  const { selection, doc } = editor.state;
  const { $from, from, to, empty } = selection;
  const entireDoc =
    doc.childCount > 1 && from <= 1 && to >= doc.content.size - 1;

  if (empty || entireDoc) {
    let depth = $from.depth;
    while (depth > 0 && !$from.node(depth).isTextblock) {
      depth -= 1;
    }
    if (depth > 0) {
      editor.commands.setTextSelection({
        from: $from.start(depth),
        to: $from.end(depth),
      });
    }
  }

  command();
}

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isYoutubeUrl(raw: string): boolean {
  try {
    const href = normalizeHref(raw);
    const host = new URL(href).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

type UrlPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pressed: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  inputId: string;
  inputLabel: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
  extraAction?: ReactNode;
  children: ReactNode;
};

function UrlPopover({
  open,
  onOpenChange,
  pressed,
  disabled,
  label,
  title,
  inputId,
  inputLabel,
  placeholder,
  value,
  onValueChange,
  onSave,
  extraAction,
  children,
}: UrlPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={pressed || open}
          disabled={disabled}
          aria-label={label}
          title={title ?? label}
          onMouseDown={(event) => event.preventDefault()}
        >
          {children}
        </Toggle>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-3 p-3"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            document.getElementById(inputId)?.focus();
          });
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={inputId}>{inputLabel}</Label>
          <Input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              onSave();
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onSave}>
            Сохранить
          </Button>
          {extraAction}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type EditorToolbarProps = {
  editor: Editor;
  disabled?: boolean;
  isUploadingImage?: boolean;
  isUploadingAudio?: boolean;
  isUploadingVideo?: boolean;
  onOpenImagePicker: () => void;
  onOpenAudioPicker: () => void;
  onOpenVideoPicker: () => void;
};

export function EditorToolbar({
  editor,
  disabled = false,
  isUploadingImage = false,
  isUploadingAudio = false,
  isUploadingVideo = false,
  onOpenImagePicker,
  onOpenAudioPicker,
  onOpenVideoPicker,
}: EditorToolbarProps) {
  const isUploading = isUploadingImage || isUploadingAudio || isUploadingVideo;
  const linkInputId = useId();
  const youtubeInputId = useId();

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkSelectionRef = useRef<EditorSelection | null>(null);

  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const youtubeSelectionRef = useRef<EditorSelection | null>(null);

  function handleLinkOpenChange(open: boolean) {
    if (open) {
      linkSelectionRef.current = snapshotSelection(editor);
      setLinkUrl(String(editor.getAttributes("link").href ?? ""));
    } else {
      requestAnimationFrame(() => editor.view.focus());
    }
    setLinkOpen(open);
  }

  function applyLink() {
    restoreSelection(editor, linkSelectionRef.current);
    const href = normalizeHref(linkUrl);
    if (!href) {
      editor.chain().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
    editor.view.focus();
  }

  function removeLink() {
    restoreSelection(editor, linkSelectionRef.current);
    editor.chain().extendMarkRange("link").unsetLink().run();
    setLinkUrl("");
    setLinkOpen(false);
    editor.view.focus();
  }

  function handleYoutubeOpenChange(open: boolean) {
    if (open) {
      youtubeSelectionRef.current = snapshotSelection(editor);
      setYoutubeUrl("");
    } else {
      requestAnimationFrame(() => editor.view.focus());
    }
    setYoutubeOpen(open);
  }

  function applyYoutube() {
    const href = normalizeHref(youtubeUrl);
    if (!href || !isYoutubeUrl(href)) {
      toast.error("Вставьте ссылку на YouTube.");
      return;
    }
    restoreSelection(editor, youtubeSelectionRef.current);
    editor.commands.setYoutubeVideo({ src: href });
    setYoutubeOpen(false);
    setYoutubeUrl("");
    editor.view.focus();
  }

  return (
    <div
      className="flex shrink-0 flex-wrap gap-0.5 border-b border-border bg-muted/40 p-1"
      role="toolbar"
      aria-label="Форматирование текста"
    >
      <FormatToggle
        pressed={editor.isActive("bold")}
        disabled={disabled}
        label="Жирный"
        onToggle={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("italic")}
        disabled={disabled}
        label="Курсив"
        onToggle={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("strike")}
        disabled={disabled}
        label="Зачёркнутый"
        onToggle={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("underline")}
        disabled={disabled}
        label="Подчёркнутый"
        onToggle={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("highlight")}
        disabled={disabled}
        label="Выделение"
        onToggle={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        label="Заголовок 2"
        title="Крупный текст (заголовок 2)"
        onToggle={() =>
          runOnActiveBlock(editor, () =>
            editor.commands.toggleHeading({ level: 2 }),
          )
        }
      >
        <Heading2 />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        label="Заголовок 3"
        title="Средний текст (заголовок 3)"
        onToggle={() =>
          runOnActiveBlock(editor, () =>
            editor.commands.toggleHeading({ level: 3 }),
          )
        }
      >
        <Heading3 />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("bulletList")}
        disabled={disabled}
        label="Маркированный список"
        onToggle={() =>
          runOnActiveBlock(editor, () => editor.commands.toggleBulletList())
        }
      >
        <List />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("orderedList")}
        disabled={disabled}
        label="Нумерованный список"
        onToggle={() =>
          runOnActiveBlock(editor, () => editor.commands.toggleOrderedList())
        }
      >
        <ListOrdered />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive({ textAlign: "left" })}
        disabled={disabled}
        label="Выравнивание по левому краю"
        onToggle={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive({ textAlign: "center" })}
        disabled={disabled}
        label="Выравнивание по центру"
        onToggle={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive({ textAlign: "right" })}
        disabled={disabled}
        label="Выравнивание по правому краю"
        onToggle={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight />
      </FormatToggle>
      <FormatToggle
        pressed={editor.isActive("blockquote")}
        disabled={disabled}
        label="Цитата"
        onToggle={() =>
          runOnActiveBlock(editor, () => editor.commands.toggleBlockquote())
        }
      >
        <Quote />
      </FormatToggle>
      <UrlPopover
        open={linkOpen}
        onOpenChange={handleLinkOpenChange}
        pressed={editor.isActive("link")}
        disabled={disabled}
        label="Ссылка"
        inputId={linkInputId}
        inputLabel="Адрес ссылки"
        placeholder="https://example.com"
        value={linkUrl}
        onValueChange={setLinkUrl}
        onSave={applyLink}
        extraAction={
          editor.isActive("link") || linkUrl.trim() ? (
            <Button type="button" size="sm" variant="outline" onClick={removeLink}>
              Убрать
            </Button>
          ) : null
        }
      >
        <LinkIcon />
      </UrlPopover>
      <FormatToggle
        pressed={false}
        disabled={disabled}
        label="Горизонтальная линия"
        onToggle={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus />
      </FormatToggle>
      <FormatToggle
        pressed={false}
        disabled={disabled || isUploading}
        label="Вставить изображение"
        onToggle={onOpenImagePicker}
      >
        {isUploadingImage ? <Loader2 className="animate-spin" /> : <ImageIcon />}
      </FormatToggle>
      <FormatToggle
        pressed={false}
        disabled={disabled || isUploading}
        label="Вставить аудио"
        onToggle={onOpenAudioPicker}
      >
        {isUploadingAudio ? <Loader2 className="animate-spin" /> : <Music />}
      </FormatToggle>
      <FormatToggle
        pressed={false}
        disabled={disabled || isUploading}
        label="Вставить видео"
        onToggle={onOpenVideoPicker}
      >
        {isUploadingVideo ? <Loader2 className="animate-spin" /> : <Film />}
      </FormatToggle>
      <UrlPopover
        open={youtubeOpen}
        onOpenChange={handleYoutubeOpenChange}
        pressed={false}
        disabled={disabled}
        label="Вставить YouTube"
        inputId={youtubeInputId}
        inputLabel="Ссылка на YouTube"
        placeholder="https://www.youtube.com/watch?v=…"
        value={youtubeUrl}
        onValueChange={setYoutubeUrl}
        onSave={applyYoutube}
      >
        <YoutubeIcon />
      </UrlPopover>
    </div>
  );
}
