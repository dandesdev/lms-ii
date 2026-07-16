"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { Transformer } from "@lexical/markdown";
import { registerSectionAwareElementMarkdownShortcuts } from "./section-aware-markdown-shortcuts";

export function SectionAwareMarkdownShortcutPlugin({
  transformers,
}: {
  transformers: Transformer[];
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerSectionAwareElementMarkdownShortcuts(editor, transformers);
  }, [editor, transformers]);

  return null;
}
