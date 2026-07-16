import type {
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalNode,
  SerializedElementNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, ElementNode } from "lexical";

export type SerializedEditorSectionNode = Spread<
  { type: "editor-section" },
  SerializedElementNode
>;

/** Wrapper for all blocks between `---` section separators. */
export class EditorSectionNode extends ElementNode {
  static getType(): string {
    return "editor-section";
  }

  static clone(node: EditorSectionNode): EditorSectionNode {
    return new EditorSectionNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedEditorSectionNode
  ): EditorSectionNode {
    return $createEditorSectionNode().updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedEditorSectionNode {
    return {
      ...super.exportJSON(),
      type: "editor-section",
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.className = config.theme.editorSection ?? "editor-section";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      section: () => ({
        conversion: (): DOMConversionOutput => ({
          node: $createEditorSectionNode(),
        }),
        priority: 1,
      }),
      div: (domNode: HTMLElement) => {
        if (!domNode.classList.contains("editor-section")) return null;
        return {
          conversion: (): DOMConversionOutput => ({
            node: $createEditorSectionNode(),
          }),
          priority: 2,
        };
      },
    };
  }

  isInline(): false {
    return false;
  }

  canBeEmpty(): false {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createEditorSectionNode(): EditorSectionNode {
  return $applyNodeReplacement(new EditorSectionNode());
}

export function $isEditorSectionNode(
  node: LexicalNode | null | undefined
): node is EditorSectionNode {
  return node instanceof EditorSectionNode;
}
