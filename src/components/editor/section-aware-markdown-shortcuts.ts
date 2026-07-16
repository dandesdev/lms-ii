/**
 * Element markdown shortcuts that also fire when the paragraph lives under
 * EditorSectionNode (stock Lexical only allows root/shadow grandparents).
 */
import {
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  type ElementNode,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { $isCodeNode } from "@lexical/code";
import type {
  ElementTransformer,
  MultilineElementTransformer,
  Transformer,
} from "@lexical/markdown";
import { $isEditorSectionNode } from "./editor-section-node";

function indexBy<T>(
  list: T[],
  callback: (item: T) => string | undefined
): Record<string, T[]> {
  const index: Record<string, T[]> = {};
  for (const item of list) {
    const key = callback(item);
    if (!key) continue;
    if (index[key]) index[key].push(item);
    else index[key] = [item];
  }
  return index;
}

function $isMarkdownElementParent(
  node: ReturnType<ElementNode["getParent"]>
): boolean {
  return $isRootOrShadowRoot(node) || $isEditorSectionNode(node);
}

function canContainTransformableMarkdown(
  node: TextNode | null | undefined
): node is TextNode {
  return (
    $isTextNode(node) &&
    !node.hasFormat("code") &&
    !$isCodeNode(node.getParent())
  );
}

function runElementTransformers(
  parentNode: ElementNode,
  anchorNode: TextNode,
  anchorOffset: number,
  elementTransformers: ElementTransformer[]
): boolean {
  const grandParentNode = parentNode.getParent();
  if (
    !$isMarkdownElementParent(grandParentNode) ||
    parentNode.getFirstChild() !== anchorNode
  ) {
    return false;
  }

  const textContent = anchorNode.getTextContent();
  if (textContent[anchorOffset - 1] !== " ") {
    return false;
  }

  for (const { regExp, replace } of elementTransformers) {
    const match = textContent.match(regExp);
    if (
      match &&
      match[0].length ===
        (match[0].endsWith(" ") ? anchorOffset : anchorOffset - 1)
    ) {
      const nextSiblings = anchorNode.getNextSiblings();
      const [leadingNode, remainderNode] = anchorNode.splitText(anchorOffset);
      const siblings = remainderNode
        ? [remainderNode, ...nextSiblings]
        : nextSiblings;
      if (replace(parentNode, siblings, match, false) !== false) {
        leadingNode.remove();
        return true;
      }
    }
  }
  return false;
}

function runMultilineElementTransformers(
  parentNode: ElementNode,
  anchorNode: TextNode,
  anchorOffset: number,
  elementTransformers: MultilineElementTransformer[]
): boolean {
  const grandParentNode = parentNode.getParent();
  if (
    !$isMarkdownElementParent(grandParentNode) ||
    parentNode.getFirstChild() !== anchorNode
  ) {
    return false;
  }

  const textContent = anchorNode.getTextContent();
  if (textContent[anchorOffset - 1] !== " ") {
    return false;
  }

  for (const { regExpStart, replace, regExpEnd } of elementTransformers) {
    if (
      (regExpEnd && !("optional" in regExpEnd)) ||
      (regExpEnd && "optional" in regExpEnd && !regExpEnd.optional)
    ) {
      continue;
    }
    const match = textContent.match(regExpStart);
    if (
      match &&
      match[0].length ===
        (match[0].endsWith(" ") ? anchorOffset : anchorOffset - 1)
    ) {
      const nextSiblings = anchorNode.getNextSiblings();
      const [leadingNode, remainderNode] = anchorNode.splitText(anchorOffset);
      const siblings = remainderNode
        ? [remainderNode, ...nextSiblings]
        : nextSiblings;
      if (
        replace(parentNode, siblings, match, null, null, false) !== false
      ) {
        leadingNode.remove();
        return true;
      }
    }
  }
  return false;
}

export function registerSectionAwareElementMarkdownShortcuts(
  editor: LexicalEditor,
  transformers: Transformer[]
): () => void {
  const byType = indexBy(transformers, (t) => t.type);
  const elementTransformers = (byType.element || []) as ElementTransformer[];
  const multilineElementTransformers = (byType["multiline-element"] ||
    []) as MultilineElementTransformer[];

  return editor.registerUpdateListener(
    ({ tags, dirtyLeaves, editorState, prevEditorState }) => {
      if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) return;
      if (editor.isComposing()) return;

      const selection = editorState.read($getSelection);
      const prevSelection = prevEditorState.read($getSelection);

      if (
        !$isRangeSelection(prevSelection) ||
        !$isRangeSelection(selection) ||
        !selection.isCollapsed() ||
        selection.is(prevSelection)
      ) {
        return;
      }

      const anchorKey = selection.anchor.key;
      const anchorOffset = selection.anchor.offset;
      const anchorNode = editorState._nodeMap.get(anchorKey);
      if (
        !$isTextNode(anchorNode) ||
        !dirtyLeaves.has(anchorKey) ||
        (anchorOffset !== 1 &&
          anchorOffset > prevSelection.anchor.offset + 1)
      ) {
        return;
      }

      editor.update(() => {
        if (!canContainTransformableMarkdown(anchorNode)) return;
        const parentNode = anchorNode.getParent();
        if (parentNode === null || $isCodeNode(parentNode)) return;

        if (
          runElementTransformers(
            parentNode,
            anchorNode,
            anchorOffset,
            elementTransformers
          )
        ) {
          return;
        }
        runMultilineElementTransformers(
          parentNode,
          anchorNode,
          anchorOffset,
          multilineElementTransformers
        );
      });
    }
  );
}
