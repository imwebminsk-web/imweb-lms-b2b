import parse, { type DOMNode, type Element } from "html-react-parser";

import { NativeMediaReviewPlaceholder } from "@/components/quiz/NativeMediaReviewPlaceholder";

function isDomElement(node: DOMNode): node is Element {
  return node.type === "tag" && "attribs" in node;
}

/** Заменяет `<video>` / `<audio>` на placeholder в режиме разбора. */
export function parseReviewHtmlWithHiddenNativeMedia(html: string) {
  let mediaIndex = 0;
  return parse(html, {
    replace(domNode) {
      if (!isDomElement(domNode)) return undefined;
      const tag = domNode.name?.toLowerCase();
      if (tag === "video" || tag === "audio") {
        const key = `review-media-${mediaIndex++}-${domNode.attribs.src ?? tag}`;
        return <NativeMediaReviewPlaceholder key={key} />;
      }
      return undefined;
    },
  });
}
