"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $createParagraphNode, $getRoot } from "lexical";
import { useIsEditorSynchronized } from "./use-is-editor-synchronized";
import { TABLE } from "./table-markdown";
import { SECTION_SEPARATOR } from "./section-separator-markdown";
import { $createEditorSectionNode } from "./editor-section-node";
import { $normalizeRootIntoSections } from "./section-utils";

const SEED_TRANSFORMERS = [SECTION_SEPARATOR, TABLE, ...TRANSFORMERS];

/**
 * Fallback first-write if the server seed did not run (or room is still empty).
 * Prefer ensureCollabRoomSeeded on the server so clients rarely hit this path.
 */
export function SeedMarkdownPlugin({
  markdown,
}: {
  markdown: string | null;
}) {
  const [editor] = useLexicalComposerContext();
  const isSynchronized = useIsEditorSynchronized();
  const done = useRef(false);

  useEffect(() => {
    if (!isSynchronized || done.current) return;

    const empty = editor.getEditorState().read(() => {
      const root = $getRoot();
      return root.getChildrenSize() === 0 && root.getTextContent().trim() === "";
    });
    if (!empty) {
      done.current = true;
      return;
    }

    done.current = true;

    editor.update(
      () => {
        if (markdown && markdown.trim()) {
          $convertFromMarkdownString(markdown, SEED_TRANSFORMERS);
          $normalizeRootIntoSections(true);
        } else {
          const root = $getRoot();
          root.clear();
          const section = $createEditorSectionNode();
          section.append($createParagraphNode());
          root.append(section);
          section.selectStart();
        }
      },
      { discrete: true }
    );
  }, [editor, isSynchronized, markdown]);

  return null;
}
