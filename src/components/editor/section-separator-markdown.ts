import type { ElementTransformer } from "@lexical/markdown";
import {
  $createSectionSeparatorNode,
  $isSectionSeparatorNode,
  SectionSeparatorNode,
} from "./section-separator-node";
import { $splitSectionAtBlock } from "./section-utils";

/**
 * `---` / `***` / `___` + space splits the current section:
 *   Section | Separator | Section
 * using Yjs-safe JSON recreate (no live reparent).
 */
export const SECTION_SEPARATOR: ElementTransformer = {
  dependencies: [SectionSeparatorNode],
  type: "element",
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    if (isImport) {
      const node = $createSectionSeparatorNode();
      parentNode.replace(node);
      return;
    }
    $splitSectionAtBlock(parentNode);
  },
  export: (node) => {
    if (!$isSectionSeparatorNode(node)) return null;
    return "---";
  },
};
