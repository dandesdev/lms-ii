"use client";

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  DecoratorNode,
} from "lexical";
import { $isEditorSectionNode } from "./editor-section-node";

export type SerializedSectionSeparatorNode = Spread<
  { type: "section-separator" },
  SerializedLexicalNode
>;

/**
 * Root-level `---` between EditorSectionNodes. Delete merges next→prev
 * (top color wins).
 */
export class SectionSeparatorNode extends DecoratorNode<null> {
  static getType(): string {
    return "section-separator";
  }

  static clone(node: SectionSeparatorNode): SectionSeparatorNode {
    return new SectionSeparatorNode(node.__key);
  }

  static importJSON(
    _serializedNode: SerializedSectionSeparatorNode
  ): SectionSeparatorNode {
    return $createSectionSeparatorNode();
  }

  exportJSON(): SerializedSectionSeparatorNode {
    return {
      type: "section-separator",
      version: 1,
    };
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const hr = document.createElement("hr");
    hr.className =
      config.theme.sectionSeparator ?? "editor-section-separator";
    return hr;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement("hr") };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: (): DOMConversionOutput => ({
          node: $createSectionSeparatorNode(),
        }),
        priority: 0,
      }),
    };
  }

  getTextContent(): string {
    return "\n";
  }

  isInline(): false {
    return false;
  }

  decorate(): null {
    return null;
  }

  remove(preserveEmptyParent?: boolean): void {
    const prev = this.getPreviousSibling();
    const next = this.getNextSibling();
    if ($isEditorSectionNode(prev) && $isEditorSectionNode(next)) {
      const movable = [...next.getChildren()];
      for (const child of movable) {
        prev.append(child);
      }
      next.remove();
      super.remove(preserveEmptyParent);
      if (prev.getChildrenSize() === 0) {
        prev.append($createParagraphNode());
      }
      return;
    }
    super.remove(preserveEmptyParent);
  }
}

export function $createSectionSeparatorNode(): SectionSeparatorNode {
  return $applyNodeReplacement(new SectionSeparatorNode());
}

export function $isSectionSeparatorNode(
  node: LexicalNode | null | undefined
): node is SectionSeparatorNode {
  return node instanceof SectionSeparatorNode;
}
