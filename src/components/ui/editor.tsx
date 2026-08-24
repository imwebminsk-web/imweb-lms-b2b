"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import Highlight from "@tiptap/extension-highlight";
import TipTapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import StarterKit from "@tiptap/starter-kit";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EditorToolbar } from "@/components/ui/editor-toolbar";
import { TipTapAudio } from "@/components/ui/tiptap-audio-extension";
import { TipTapVideo } from "@/components/ui/tiptap-video-extension";
import {
  COURSE_IMAGE_MAX_BYTES,
  compressImage,
} from "@/lib/utils/image-compression";
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
        // Свою ссылку настраиваем ниже; иначе расширение регистрируется дважды.
        link: false,
        underline: false,
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
          "tiptap prose prose-sm max-w-none px-3 py-2",
          "prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800",
          "prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic",
          "prose-strong:font-bold prose-em:italic [&_u]:underline",
          "prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-xl prose-h2:font-semibold prose-h2:leading-snug",
          "prose-h3:mt-3 prose-h3:mb-2 prose-h3:text-lg prose-h3:font-semibold prose-h3:leading-snug",
          "prose-img:mx-auto prose-img:rounded-md prose-img:shadow-sm",
          "prose-iframe:mx-auto prose-iframe:w-full prose-iframe:max-w-full",
          "[&_.tiptap-audio-player]:mx-auto [&_.tiptap-audio-player]:my-2 [&_.tiptap-audio-player]:block [&_.tiptap-audio-player]:h-10 [&_.tiptap-audio-player]:w-full [&_.tiptap-audio-player]:max-w-lg",
          "[&_.tiptap-video-player]:mx-auto [&_.tiptap-video-player]:my-4 [&_.tiptap-video-player]:block [&_.tiptap-video-player]:aspect-video [&_.tiptap-video-player]:w-full [&_.tiptap-video-player]:max-w-3xl [&_.tiptap-video-player]:rounded-lg",
          "dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300",
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

      if (compressed.size > COURSE_IMAGE_MAX_BYTES) {
        toast.error("Изображение после сжатия всё ещё больше 1 МБ.");
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
        toast.error(payload.error || "Не удалось загрузить изображение.");
        return;
      }

      editor.chain().focus().setImage({ src: payload.url }).run();
    } catch {
      toast.error("Не удалось обработать или загрузить изображение.");
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
      toast.error(
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
      toast.error("Файл слишком большой. Максимум 50 МБ.");
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
      toast.error(
        err instanceof Error ? err.message : "Не удалось загрузить видео.",
      );
    } finally {
      setIsUploadingVideo(false);
    }
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
      <EditorToolbar
        editor={editor}
        disabled={disabled}
        isUploadingImage={isUploadingImage}
        isUploadingAudio={isUploadingAudio}
        isUploadingVideo={isUploadingVideo}
        onOpenImagePicker={openImagePicker}
        onOpenAudioPicker={openAudioPicker}
        onOpenVideoPicker={openVideoPicker}
      />
      <EditorContent
        editor={editor}
        className="[&_.tiptap]:min-h-[6rem]"
      />
    </div>
  );
}
