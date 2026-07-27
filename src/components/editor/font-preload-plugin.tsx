"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $isTextNode, type LexicalNode } from "lexical";
import { useIsEditorSynchronized } from "./use-is-editor-synchronized";
import { ensureFontForCssFamily } from "@/lib/fonts/ensure-font";

function collectFontFamilies(node: LexicalNode, into: Set<string>) {
  if ($isTextNode(node)) {
    const family = node.getStyle()
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("font-family:"))
      ?.slice("font-family:".length)
      .trim();
    if (family) into.add(family.replace(/^["']|["']$/g, ""));
  }
  if ("getChildren" in node && typeof node.getChildren === "function") {
    for (const child of node.getChildren()) {
      collectFontFamilies(child, into);
    }
  }
}

/**
 * After Yjs sync, preload any catalog fonts already used in the document so
 * student/share viewers (and teachers reopening a class) avoid FOUT.
 */
export function FontPreloadPlugin() {
  const [editor] = useLexicalComposerContext();
  const isSynchronized = useIsEditorSynchronized();
  const done = useRef(false);

  useEffect(() => {
    if (!isSynchronized || done.current) return;
    done.current = true;

    const families = new Set<string>();
    editor.getEditorState().read(() => {
      collectFontFamilies($getRoot(), families);
    });

    for (const family of families) {
      void ensureFontForCssFamily(family);
    }
  }, [editor, isSynchronized]);

  return null;
}
