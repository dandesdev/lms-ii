"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $getRoot } from "lexical";
import { useIsEditorReady } from "@liveblocks/react-lexical";

export function SeedMarkdownPlugin({
  markdown,
}: {
  markdown: string | null;
}) {
  const [editor] = useLexicalComposerContext();
  const isReady = useIsEditorReady();

  useEffect(() => {
    if (!isReady || !markdown) return;

    editor.getEditorState().read(() => {
      const root = $getRoot();
      if (root.getTextContent().trim() !== "") return;

      editor.update(() => {
        $convertFromMarkdownString(markdown, TRANSFORMERS);
      });
    });
  }, [editor, isReady, markdown]);

  return null;
}
