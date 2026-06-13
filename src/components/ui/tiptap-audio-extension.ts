import { mergeAttributes, Node } from "@tiptap/react";

/** Блочный `<audio controls>` — вставляется через панель редактора. */
export const TipTapAudio = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("src"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.src ? { src: String(attributes.src) } : {},
      },
      controls: {
        default: true,
        parseHTML: () => true,
        renderHTML: () => ({ controls: "controls" }),
      },
      preload: {
        default: "metadata",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("preload") ?? "metadata",
        renderHTML: (attributes: Record<string, unknown>) => ({
          preload: String(attributes.preload ?? "metadata"),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "audio[controls]" }, { tag: "audio[src]" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "audio",
      mergeAttributes(HTMLAttributes, {
        controls: "controls",
        class: "tiptap-audio-player",
      }),
    ];
  },
});
