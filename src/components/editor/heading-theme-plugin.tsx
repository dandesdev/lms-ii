"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode } from "lexical";
import { HeadingNode } from "@lexical/rich-text";
import { getHeadingTheme, type HeadingTag } from "@/lib/editor-theme";
import { useHeadingThemeOptional } from "./heading-theme-context";
import {
  $ensureTextMatchesHeadingTheme,
  $isTextNodeInHeading,
} from "./heading-style";

/**
 * When a class has a saved heading style, fill missing font/color on new
 * heading text so freshly inserted H2s match. App-default Playful look comes
 * from Lexical theme classes (`font-playful`) — not from this plugin — so
 * picking Inter (or clearing the face) is not immediately overwritten.
 */
export function HeadingThemePlugin() {
  const [editor] = useLexicalComposerContext();
  const ctx = useHeadingThemeOptional();
  const theme = ctx?.theme;

  useEffect(() => {
    const savedHeadings = theme?.headings;
    if (!savedHeadings) return;

    const applyIfSaved = (tag: HeadingTag, texts: TextNode[]) => {
      if (!savedHeadings[tag]) return;
      const level = getHeadingTheme(theme, tag);
      for (const text of texts) {
        $ensureTextMatchesHeadingTheme(text, level);
      }
    };

    const removeHeading = editor.registerNodeTransform(HeadingNode, (heading) => {
      applyIfSaved(heading.getTag() as HeadingTag, heading.getAllTextNodes());
    });
    const removeText = editor.registerNodeTransform(TextNode, (node) => {
      const heading = $isTextNodeInHeading(node);
      if (!heading) return;
      applyIfSaved(heading.getTag() as HeadingTag, [node]);
    });

    return () => {
      removeHeading();
      removeText();
    };
  }, [editor, theme]);

  return null;
}
