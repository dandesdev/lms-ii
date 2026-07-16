import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type ElementNode,
  type LexicalNode,
} from "lexical";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $isListNode } from "@lexical/list";
import { $isTableNode } from "@lexical/table";
import {
  parseBlockVisualStyle,
  serializeBlockVisualStyle,
} from "./block-style";
import {
  $createEditorSectionNode,
  $isEditorSectionNode,
  type EditorSectionNode,
} from "./editor-section-node";
import {
  $createSectionSeparatorNode,
  $isSectionSeparatorNode,
  type SectionSeparatorNode,
} from "./section-separator-node";

function $isSectionContentNode(
  node: LexicalNode
): node is ElementNode & { setStyle(style: string): ElementNode } {
  return (
    $isElementNode(node) &&
    ($isParagraphNode(node) ||
      $isHeadingNode(node) ||
      $isQuoteNode(node) ||
      $isListNode(node) ||
      $isTableNode(node))
  );
}

/** True when root children are only sections + separators. */
export function $usesSectionWrappers(): boolean {
  const root = $getRoot();
  const children = root.getChildren();
  if (children.length === 0) return false;
  return !children.some(
    (child) => !$isEditorSectionNode(child) && !$isSectionSeparatorNode(child)
  );
}

export function $isLegacyFlatDocument(): boolean {
  return !$usesSectionWrappers();
}

export function $getTopLevelSectionNode(node: LexicalNode): LexicalNode {
  let current: LexicalNode = node;
  while (current.getParent() && !$isRootOrShadowRoot(current.getParent()!)) {
    current = current.getParent()!;
  }
  return current;
}

/** Legacy flat: blocks between root-level separators. */
export function $getSectionBlocksAtCursor(): Array<
  ElementNode & { setStyle(style: string): ElementNode }
> {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return [];

  const topLevel = $getTopLevelSectionNode(selection.anchor.getNode());
  const root = $getRoot();
  const children = root.getChildren();
  let topIndex = children.findIndex((c) => c.getKey() === topLevel.getKey());
  if (topIndex < 0) return [];

  let sectionStart = 0;
  for (let i = topIndex - 1; i >= 0; i--) {
    if ($isSectionSeparatorNode(children[i])) {
      sectionStart = i + 1;
      break;
    }
  }
  let sectionEnd = children.length - 1;
  for (let i = topIndex + 1; i < children.length; i++) {
    if ($isSectionSeparatorNode(children[i])) {
      sectionEnd = i - 1;
      break;
    }
  }

  const blocks: Array<ElementNode & { setStyle(style: string): ElementNode }> =
    [];
  for (let i = sectionStart; i <= sectionEnd; i++) {
    const child = children[i];
    if ($isSectionContentNode(child)) blocks.push(child);
  }
  return blocks;
}

export function $applySectionBackgroundAtCursor(color: string | null): void {
  if ($usesSectionWrappers()) {
    const section = $getSectionAtCursor();
    if (!section) return;
    section
      .getWritable()
      .setStyle(serializeBlockVisualStyle({ sectionBg: color ?? undefined }));
    return;
  }

  for (const block of $getSectionBlocksAtCursor()) {
    const v = parseBlockVisualStyle(block.getStyle());
    block.getWritable().setStyle(
      serializeBlockVisualStyle({
        ...v,
        sectionBg: color ?? undefined,
      })
    );
  }
}

function $hoistSectionBgFromBlocks(blocks: LexicalNode[]): string | undefined {
  let sectionBg: string | undefined;
  for (const block of blocks) {
    if (!$isElementNode(block)) continue;
    const visual = parseBlockVisualStyle(block.getStyle());
    if (visual.sectionBg) sectionBg = visual.sectionBg;
    if (visual.sectionBg) {
      block.getWritable().setStyle(
        serializeBlockVisualStyle({
          highlightBg: visual.highlightBg,
          highlightBorder: visual.highlightBorder,
        })
      );
    }
  }
  return sectionBg;
}

function $padEmptySections(): void {
  const root = $getRoot();
  for (const child of root.getChildren()) {
    if ($isEditorSectionNode(child) && child.getChildrenSize() === 0) {
      child.append($createParagraphNode());
    }
  }
}

/**
 * Wrap markdown-imported root (paragraphs + separators) into sections.
 *
 * Safe as the **first** Lexical→Yjs write into an empty room (seed). In that
 * case in-place append is fine — there is no prior collab binding to reparent
 * against. Do not call this on already-synced flat rooms.
 */
export function $normalizeRootIntoSections(force = false): void {
  if (!force && $isLegacyFlatDocument()) return;
  const root = $getRoot();

  if (root.getChildrenSize() === 0) {
    const section = $createEditorSectionNode();
    section.append($createParagraphNode());
    root.append(section);
    return;
  }

  // Already wrapped.
  if ($usesSectionWrappers()) {
    $padEmptySections();
    return;
  }

  let node: LexicalNode | null = root.getFirstChild();
  while (node) {
    if ($isSectionSeparatorNode(node) || $isEditorSectionNode(node)) {
      node = node.getNextSibling();
      continue;
    }

    const loose: LexicalNode[] = [];
    let cursor: LexicalNode | null = node;
    while (
      cursor &&
      !$isSectionSeparatorNode(cursor) &&
      !$isEditorSectionNode(cursor)
    ) {
      loose.push(cursor);
      cursor = cursor.getNextSibling();
    }

    const section = $createEditorSectionNode();
    const sectionBg = $hoistSectionBgFromBlocks(loose);
    loose[0].insertBefore(section);
    for (const block of loose) {
      section.append(block);
    }
    if (section.getChildrenSize() === 0) {
      section.append($createParagraphNode());
    }
    if (sectionBg) {
      section.setStyle(serializeBlockVisualStyle({ sectionBg }));
    }

    node = section.getNextSibling();
  }

  // Leading separator → insert empty section before it.
  const first = root.getFirstChild();
  if ($isSectionSeparatorNode(first)) {
    const section = $createEditorSectionNode();
    section.append($createParagraphNode());
    first.insertBefore(section);
  }

  // Trailing separator → empty section after.
  const last = root.getLastChild();
  if ($isSectionSeparatorNode(last)) {
    const section = $createEditorSectionNode();
    section.append($createParagraphNode());
    last.insertAfter(section);
  }

  // Adjacent separators → empty section between.
  for (const child of [...root.getChildren()]) {
    if (!$isSectionSeparatorNode(child)) continue;
    const next = child.getNextSibling();
    if ($isSectionSeparatorNode(next)) {
      const section = $createEditorSectionNode();
      section.append($createParagraphNode());
      child.insertAfter(section);
    }
  }

  $padEmptySections();

  // Select into first paragraph so we never leave offset on an empty section.
  const firstSection = root.getFirstChild();
  if ($isEditorSectionNode(firstSection)) {
    const p = firstSection.getFirstChild();
    if ($isParagraphNode(p)) {
      p.selectStart();
    }
  }
}

export function $ensureSectionStructure(): void {
  const root = $getRoot();
  if (root.getChildrenSize() === 0) {
    const section = $createEditorSectionNode();
    section.append($createParagraphNode());
    root.append(section);
  }
}

/**
 * Split at the block that contained `---` (Yjs-safe: move trailing blocks into
 * a brand-new section created in this update — create/append only for moved
 * content via insertAfter of a new parent after removing from old).
 *
 * Moving with append(block) within the same update is the Lexical-native
 * approach; peers receive delete+insert. Prefer this over full-tree JSON rewrite.
 */
export function $splitSectionAtBlock(block: ElementNode): void {
  const section = block.getParent();
  if (!$isEditorSectionNode(section)) {
    const sep = $createSectionSeparatorNode();
    const next = $createEditorSectionNode();
    next.append($createParagraphNode());
    block.replace(sep);
    sep.insertAfter(next);
    next.selectStart();
    return;
  }

  const after: LexicalNode[] = [];
  let sib = block.getNextSibling();
  while (sib) {
    after.push(sib);
    sib = sib.getNextSibling();
  }

  block.remove();

  const sep = $createSectionSeparatorNode();
  const nextSection = $createEditorSectionNode();
  for (const n of after) {
    nextSection.append(n);
  }
  if (nextSection.getChildrenSize() === 0) {
    nextSection.append($createParagraphNode());
  }
  if (section.getChildrenSize() === 0) {
    section.append($createParagraphNode());
  }

  section.insertAfter(sep);
  sep.insertAfter(nextSection);
  nextSection.selectStart();
}

/**
 * When two EditorSectionNodes sit adjacent (separator deleted via local edit,
 * undo, or remote sync), merge next → prev. Prev style wins (top color).
 * Returns true if a merge ran (transforms re-run until stable).
 */
export function $mergeAdjacentEditorSections(): boolean {
  const root = $getRoot();
  const children = root.getChildren();
  for (let i = 0; i < children.length - 1; i++) {
    const prev = children[i];
    const next = children[i + 1];
    if (!$isEditorSectionNode(prev) || !$isEditorSectionNode(next)) continue;

    const movable = [...next.getChildren()];
    for (const child of movable) {
      prev.append(child);
    }
    next.remove();
    if (prev.getChildrenSize() === 0) {
      prev.append($createParagraphNode());
    }
    return true;
  }
  return false;
}

/** Remove separator; SectionMergePlugin merges the now-adjacent sections. */
export function $mergeSectionsAroundSeparator(
  _prev: EditorSectionNode,
  _next: EditorSectionNode,
  separator: SectionSeparatorNode
): void {
  separator.remove();
}

/** @deprecated */
export function $reparentSectionSeparator(
  separator: SectionSeparatorNode
): void {
  void separator;
}

export function $getSectionAtCursor(): EditorSectionNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  let node: LexicalNode | null = selection.anchor.getNode();
  while (node) {
    if ($isEditorSectionNode(node)) return node;
    node = node.getParent();
  }
  return null;
}
