"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RootNode } from "lexical";
import {
  $collapseAdjacentSectionSeparators,
  $mergeAdjacentEditorSections,
} from "./section-utils";

/**
 * Keeps root section structure healthy after local edits, undo, or remote Yjs
 * sync (kept out of SectionSeparatorNode.remove() so history stays predictable):
 * - Adjacent separators → keep one (avoids empty unreachable sections)
 * - Adjacent EditorSectionNodes (separator deleted) → merge; top style wins
 */
export function SectionMergePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(RootNode, () => {
      if ($collapseAdjacentSectionSeparators()) return;
      $mergeAdjacentEditorSections();
    });
  }, [editor]);

  return null;
}
