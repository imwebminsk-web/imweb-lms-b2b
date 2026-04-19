"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from "lucide-react";
import { useEffect } from "react";

import { Toggle } from "@/components/ui/toggle";
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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose prose-sm sm:prose-base dark:prose-invert max-w-none px-3 py-2",
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

  return (
    <div
      id={id}
      className={cn(
        "tiptap-editor-root flex max-w-full min-h-0 flex-col overflow-x-auto rounded-lg border border-input bg-background shadow-xs",
        className,
      )}
    >
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
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <EditorContent
          editor={editor}
          className="flex min-h-0 flex-1 flex-col [&_.tiptap]:min-h-[6rem] [&_.tiptap]:grow"
        />
      </div>
    </div>
  );
}
