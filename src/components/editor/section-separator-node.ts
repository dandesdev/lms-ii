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
import { $applyNodeReplacement, DecoratorNode } from "lexical";

export type SerializedSectionSeparatorNode = Spread<
  { type: "section-separator" },
  SerializedLexicalNode
>;

/**
 * Root-level `---` between EditorSectionNodes.
 * Merging adjacent sections is handled by SectionMergePlugin (not remove()),
 * so undo/remote sync stay consistent.
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
}

export function $createSectionSeparatorNode(): SectionSeparatorNode {
  return $applyNodeReplacement(new SectionSeparatorNode());
}

export function $isSectionSeparatorNode(
  node: LexicalNode | null | undefined
): node is SectionSeparatorNode {
  return node instanceof SectionSeparatorNode;
}
