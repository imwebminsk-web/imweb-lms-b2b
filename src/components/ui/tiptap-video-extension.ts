import { mergeAttributes, Node } from "@tiptap/react";

/** Блочный `<video controls>` — локальные mp4/webm, отдельно от YouTube iframe. */
export const TipTapVideo = Node.create({
  name: "video",
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
    return [{ tag: "video[controls]" }, { tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "controls",
        preload: "metadata",
        class: "tiptap-video-player",
        style: "max-width: 100%; border-radius: 8px;",
      }),
    ];
  },
});
