"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import Highlight from "@tiptap/extension-highlight";
import TipTapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import StarterKit from "@tiptap/starter-kit";
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
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { Toggle } from "@/components/ui/toggle";
import { TipTapAudio } from "@/components/ui/tiptap-audio-extension";
import { TipTapVideo } from "@/components/ui/tiptap-video-extension";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadTestAttachmentAudio } from "@/lib/utils/upload-test-audio";
import {
  MAX_VIDEO_BYTES,
  uploadTestAttachmentVideo,
} from "@/lib/utils/upload-test-video";
import { cn } from "@/lib/utils";

/** Сравниваем HTML так, чтобы пустой документ TipTap (`<p></p>`) считался пустой строкой. */
function normalizeEditorHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>") return "";
  return html;
}

export type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function Editor({
  value,
  onChange,
  disabled = false,
  className,
  id,
}: EditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const isUploading = isUploadingImage || isUploadingAudio || isUploadingVideo;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TipTapImage,
      TipTapAudio,
      TipTapVideo,
      Youtube.configure({
        inline: false,
        width: 640,
        height: 480,
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose prose-sm prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic prose-img:mx-auto prose-img:rounded-md prose-img:shadow-sm prose-iframe:mx-auto prose-iframe:w-full prose-iframe:max-w-full [&_.tiptap-audio-player]:mx-auto [&_.tiptap-audio-player]:my-2 [&_.tiptap-audio-player]:block [&_.tiptap-audio-player]:h-10 [&_.tiptap-audio-player]:w-full [&_.tiptap-audio-player]:max-w-lg [&_.tiptap-video-player]:mx-auto [&_.tiptap-video-player]:my-4 [&_.tiptap-video-player]:block [&_.tiptap-video-player]:aspect-video [&_.tiptap-video-player]:w-full [&_.tiptap-video-player]:max-w-3xl [&_.tiptap-video-player]:rounded-lg sm:prose-base dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none px-3 py-2",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (normalizeEditorHtml(next) === normalizeEditorHtml(editor.getHTML())) {
      return;
    }
    editor.commands.setContent(next || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        id={id}
        className={cn(
          "rounded-lg border border-input bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
        aria-busy="true"
      >
        Загрузка редактора…
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Введите URL:", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const openImagePicker = () => {
    if (disabled || isUploading) return;
    imageInputRef.current?.click();
  };

  const handleImagePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingImage(true);

    try {
      const compressed = await compressImage(file);

      if (compressed.size > 100 * 1024) {
        window.alert("Изображение после сжатия всё ещё больше 100 КБ.");
        return;
      }

      const formData = new FormData();
      formData.append("file", compressed);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        window.alert(payload.error || "Не удалось загрузить изображение.");
        return;
      }

      editor.chain().focus().setImage({ src: payload.url }).run();
    } catch {
      window.alert("Не удалось обработать или загрузить изображение.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openAudioPicker = () => {
    if (disabled || isUploading) return;
    audioInputRef.current?.click();
  };

  const handleAudioPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingAudio(true);
    try {
      const url = await uploadTestAttachmentAudio(file);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "audio",
          attrs: { src: url, controls: true, preload: "metadata" },
        })
        .run();
    } catch (err: unknown) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить аудио.",
      );
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const openVideoPicker = () => {
    if (disabled || isUploading) return;
    videoInputRef.current?.click();
  };

  const handleVideoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_VIDEO_BYTES) {
      window.alert("Файл слишком большой. Максимум 50 МБ.");
      return;
    }

    setIsUploadingVideo(true);
    try {
      const url = await uploadTestAttachmentVideo(file);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "video",
          attrs: { src: url, controls: true, preload: "metadata" },
        })
        .run();
    } catch (err: unknown) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить видео.",
      );
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const setYoutube = () => {
    const url = window.prompt(
      "Введите URL YouTube (например, https://www.youtube.com/watch?v=...):",
    );
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  return (
    <div
      id={id}
      className={cn(
        "tiptap-editor-root flex max-w-full flex-col overflow-x-hidden rounded-lg border border-input bg-background shadow-xs",
        className,
      )}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={handleImagePick}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        onChange={handleAudioPick}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg"
        className="sr-only"
        tabIndex={-1}
        onChange={handleVideoPick}
      />
      <div
        className="flex shrink-0 flex-wrap gap-0.5 border-b border-border bg-muted/40 p-1"
        role="toolbar"
        aria-label="Форматирование текста"
      >
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("bold")}
          onPressedChange={() =>
            editor.chain().focus().toggleBold().run()
          }
          disabled={disabled}
          aria-label="Жирный"
        >
          <Bold />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("italic")}
          onPressedChange={() =>
            editor.chain().focus().toggleItalic().run()
          }
          disabled={disabled}
          aria-label="Курсив"
        >
          <Italic />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("strike")}
          onPressedChange={() =>
            editor.chain().focus().toggleStrike().run()
          }
          disabled={disabled}
          aria-label="Зачёркнутый"
        >
          <Strikethrough />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("underline")}
          onPressedChange={() =>
            editor.chain().focus().toggleUnderline().run()
          }
          disabled={disabled}
          aria-label="Подчёркнутый"
        >
          <UnderlineIcon />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("highlight")}
          onPressedChange={() =>
            editor.chain().focus().toggleHighlight().run()
          }
          disabled={disabled}
          aria-label="Выделение"
        >
          <Highlighter />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={disabled}
          aria-label="Заголовок 2"
        >
          <Heading2 />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("heading", { level: 3 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={disabled}
          aria-label="Заголовок 3"
        >
          <Heading3 />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          disabled={disabled}
          aria-label="Маркированный список"
        >
          <List />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          disabled={disabled}
          aria-label="Нумерованный список"
        >
          <ListOrdered />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive({ textAlign: "left" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("left").run()
          }
          disabled={disabled}
          aria-label="Выравнивание по левому краю"
        >
          <AlignLeft />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive({ textAlign: "center" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
          disabled={disabled}
          aria-label="Выравнивание по центру"
        >
          <AlignCenter />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive({ textAlign: "right" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("right").run()
          }
          disabled={disabled}
          aria-label="Выравнивание по правому краю"
        >
          <AlignRight />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("blockquote")}
          onPressedChange={() =>
            editor.chain().focus().toggleBlockquote().run()
          }
          disabled={disabled}
          aria-label="Цитата"
        >
          <Quote />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={editor.isActive("link")}
          onPressedChange={() => setLink()}
          disabled={disabled}
          aria-label="Ссылка"
        >
          <LinkIcon />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={false}
          onPressedChange={() =>
            editor.chain().focus().setHorizontalRule().run()
          }
          disabled={disabled}
          aria-label="Горизонтальная линия"
        >
          <Minus />
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={false}
          onPressedChange={() => openImagePicker()}
          disabled={disabled || isUploading}
          aria-label="Вставить изображение"
        >
          {isUploadingImage ? <Loader2 className="animate-spin" /> : <ImageIcon />}
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={false}
          onPressedChange={() => openAudioPicker()}
          disabled={disabled || isUploading}
          aria-label="Вставить аудио"
        >
          {isUploadingAudio ? <Loader2 className="animate-spin" /> : <Music />}
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={false}
          onPressedChange={() => openVideoPicker()}
          disabled={disabled || isUploading}
          aria-label="Вставить видео"
        >
          {isUploadingVideo ? <Loader2 className="animate-spin" /> : <Film />}
        </Toggle>
        <Toggle
          type="button"
          size="sm"
          variant="outline"
          pressed={false}
          onPressedChange={() => setYoutube()}
          disabled={disabled}
          aria-label="Вставить YouTube"
        >
          <YoutubeIcon />
        </Toggle>
      </div>
      <EditorContent
        editor={editor}
        className="[&_.tiptap]:min-h-[6rem]"
      />
    </div>
  );
}
