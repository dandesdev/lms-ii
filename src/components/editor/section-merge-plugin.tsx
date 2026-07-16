"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RootNode } from "lexical";
import { $mergeAdjacentEditorSections } from "./section-utils";

/**
 * When a section separator is removed (backspace/delete, cut, undo, or remote
 * Yjs sync), adjacent EditorSectionNodes are merged — top section style wins.
 * Kept out of SectionSeparatorNode.remove() so history/sync stay predictable.
 */
export function SectionMergePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(RootNode, () => {
      $mergeAdjacentEditorSections();
    });
  }, [editor]);

  return null;
}
