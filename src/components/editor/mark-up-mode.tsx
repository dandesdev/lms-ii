"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalEditor,
} from "lexical";
import { $getNearestBlockElementAncestorOrThrow } from "@lexical/utils";
import { $patchStyleText } from "@lexical/selection";
import {
  Baseline,
  Bold,
  Eraser,
  Eye,
  Highlighter,
  Italic,
  PencilRuler,
} from "lucide-react";
import { ColorPalette, CornerSplitButton } from "./color-picker";
import { ToolbarPopover } from "./toolbar-ui";
import { $isEditorSectionNode } from "./editor-section-node";
import {
  useMarkUpMode,
  type LockedMarkUpTool,
  type MarkUpToolKind,
  type MarkSnapshot,
  type PendingMarkUpMark,
} from "./mark-up-mode-context";
import { useEditorColors } from "./editor-colors-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BlockHit = {
  blockKey: string;
  start: number;
  end: number;
};

// --- Lexical helpers (must run inside editor.read / editor.update) ----------

/** Map an absolute char offset within a block to a {textNodeKey, offset}. */
function $mapBlockOffsetToPoint(
  block: ElementNode,
  target: number
): { key: string; offset: number } | null {
  const texts = block.getAllTextNodes();
  let acc = 0;
  for (const t of texts) {
    const len = t.getTextContentSize();
    if (target <= acc + len) {
      return { key: t.getKey(), offset: target - acc };
    }
    acc += len;
  }
  const last = texts[texts.length - 1];
  if (last) return { key: last.getKey(), offset: last.getTextContentSize() };
  return null;
}

type RangeSel = ReturnType<typeof $createRangeSelection>;

function $selectBlockRange(
  blockKey: string,
  start: number,
  end: number
): RangeSel | null {
  const block = $getNodeByKey(blockKey);
  if (!$isElementNode(block)) return null;
  const a = $mapBlockOffsetToPoint(block, start);
  const b = $mapBlockOffsetToPoint(block, end);
  if (!a || !b) return null;

  const sel = $createRangeSelection();
  sel.anchor.set(a.key, a.offset, "text");
  sel.focus.set(b.key, b.offset, "text");
  $setSelection(sel);
  return sel;
}

// --- DOM ↔ Lexical point resolution ----------------------------------------

function isWordChar(ch: string): boolean {
  // Letters, numbers, and common apostrophes — not whitespace or punctuation.
  return /[\p{L}\p{N}'’]/u.test(ch);
}

/**
 * Resolve caretRangeFromPoint's container/offset to a concrete Text node.
 * Element offsets mean "before child[offset]"; offset === childCount means
 * "after the last child".
 */
function normalizeCaretNode(caret: {
  startContainer: Node;
  startOffset: number;
}): { node: Text; offset: number } | null {
  const domNode: Node = caret.startContainer;
  const offset = caret.startOffset;

  if (domNode.nodeType === Node.ELEMENT_NODE) {
    const el = domNode as Element;
    if (offset < el.childNodes.length) {
      const child = el.childNodes[offset]!;
      if (child.nodeType === Node.TEXT_NODE) {
        return { node: child as Text, offset: 0 };
      }
      const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      if (!first) return null;
      return { node: first as Text, offset: 0 };
    }
    if (offset > 0) {
      const prev = el.childNodes[offset - 1];
      if (prev?.nodeType === Node.TEXT_NODE) {
        const text = prev as Text;
        return { node: text, offset: text.data.length };
      }
      if (prev) {
        const walker = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT);
        let last: Text | null = null;
        for (;;) {
          const n = walker.nextNode() as Text | null;
          if (!n) break;
          last = n;
        }
        if (last) return { node: last, offset: last.data.length };
      }
    }
    return null;
  }

  if (domNode.nodeType !== Node.TEXT_NODE) return null;
  return { node: domNode as Text, offset };
}

/**
 * Index of the character glyph under the pointer. Caret APIs return a boundary
 * (often to the right of the glyph); using the glyph itself avoids off-by-one
 * selections like "ove_" when hovering "love".
 */
function charIndexFromPoint(
  textNode: Text,
  clientX: number,
  clientY: number,
  caretOffset: number
): number {
  const text = textNode.data;
  if (text.length === 0) return 0;

  for (let i = 0; i < text.length; i++) {
    const range = document.createRange();
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 && r.height === 0) continue;
      if (
        clientX >= r.left &&
        clientX < r.right &&
        clientY >= r.top &&
        clientY < r.bottom
      ) {
        return i;
      }
    }
  }

  // Nearest-boundary fallback: if the caret sits after a word char (or on a
  // space after one), prefer that previous character.
  const pos = Math.max(0, Math.min(caretOffset, text.length));
  if (pos > 0) {
    const atEndOrSpace = pos === text.length || !isWordChar(text[pos]!);
    if (atEndOrSpace && isWordChar(text[pos - 1]!)) return pos - 1;
  }
  if (pos >= text.length) return text.length - 1;
  return pos;
}

function expandToWord(text: string, charIndex: number): [number, number] {
  if (text.length === 0) return [0, 0];

  let pos = Math.max(0, Math.min(charIndex, text.length - 1));

  // If the pointer landed on whitespace, snap to the nearest word.
  if (!isWordChar(text[pos]!)) {
    let left = pos;
    while (left > 0 && !isWordChar(text[left]!)) left--;
    let right = pos;
    while (right < text.length - 1 && !isWordChar(text[right]!)) right++;
    if (isWordChar(text[left]!)) pos = left;
    else if (isWordChar(text[right]!)) pos = right;
    else return [pos, pos];
  }

  let s = pos;
  let e = pos + 1;
  while (s > 0 && isWordChar(text[s - 1]!)) s--;
  while (e < text.length && isWordChar(text[e]!)) e++;
  return [s, e];
}

/** Expand so both endpoints snap to word edges (for click-drag ranges). */
function expandToWordRange(
  text: string,
  fromChar: number,
  toChar: number
): [number, number] {
  const [s1, e1] = expandToWord(text, fromChar);
  const [s2, e2] = expandToWord(text, toChar);
  if (s1 === e1 && s2 === e2) return [0, 0];
  if (s1 === e1) return [s2, e2];
  if (s2 === e2) return [s1, e1];
  return [Math.min(s1, s2), Math.max(e1, e2)];
}

/** Map a pointer position to a block-relative character index (not a caret boundary). */
function pointToBlockOffset(
  editor: LexicalEditor,
  clientX: number,
  clientY: number
): {
  blockKey: string;
  sectionKey: string;
  /** Inclusive index of the character under the pointer. */
  charIndex: number;
  blockText: string;
} | null {
  const root = editor.getRootElement();
  if (!root || typeof document.caretRangeFromPoint !== "function") return null;
  const caret = document.caretRangeFromPoint(clientX, clientY);
  if (!caret || !root.contains(caret.startContainer)) return null;

  const normalized = normalizeCaretNode(caret);
  if (!normalized) return null;
  const { node: domNode, offset: caretOffset } = normalized;
  const localChar = charIndexFromPoint(domNode, clientX, clientY, caretOffset);

  let result: {
    blockKey: string;
    sectionKey: string;
    charIndex: number;
    blockText: string;
  } | null = null;
  editor.read(() => {
    const lexicalNode = $getNearestNodeFromDOMNode(domNode);
    if (!lexicalNode) return;
    let textNode = $isTextNode(lexicalNode) ? lexicalNode : null;
    if (!textNode && $isElementNode(lexicalNode)) {
      for (const t of lexicalNode.getAllTextNodes()) {
        const el = editor.getElementByKey(t.getKey());
        if (el?.contains(domNode)) {
          textNode = t;
          break;
        }
      }
    }
    if (!textNode) return;

    const block = $getNearestBlockElementAncestorOrThrow(textNode);
    let parent = block.getParent();
    while (parent && !$isEditorSectionNode(parent)) {
      parent = parent.getParent();
    }
    if (!$isEditorSectionNode(parent)) return;

    // Map DOM glyph index → Lexical text-node index (clamp on length mismatch).
    const lexicalSize = textNode.getTextContentSize();
    const localIndex = Math.min(localChar, Math.max(lexicalSize - 1, 0));

    let acc = 0;
    for (const t of block.getAllTextNodes()) {
      if (t.getKey() === textNode.getKey()) {
        acc += localIndex;
        break;
      }
      acc += t.getTextContentSize();
    }

    const blockText = block.getTextContent();
    result = {
      blockKey: block.getKey(),
      sectionKey: parent.getKey(),
      charIndex: Math.min(acc, Math.max(blockText.length - 1, 0)),
      blockText,
    };
  });
  return result;
}

/** Word under the cursor. */
function wordHitFromPoint(
  editor: LexicalEditor,
  clientX: number,
  clientY: number
): BlockHit | null {
  const p = pointToBlockOffset(editor, clientX, clientY);
  if (!p || p.blockText.length === 0) return null;
  const [start, end] = expandToWord(p.blockText, p.charIndex);
  if (start === end) return null;
  return { blockKey: p.blockKey, start, end };
}

/**
 * Text-bearing blocks of a section in document order. Uses each text node's
 * nearest block ancestor so nested structures (list items, table cells) are
 * counted as blocks — not just direct section children.
 */
function $sectionBlocksInOrder(
  sectionKey: string
): Array<{ key: string; text: string }> {
  const section = $getNodeByKey(sectionKey);
  if (!$isEditorSectionNode(section)) return [];

  const blocks: Array<{ key: string; text: string }> = [];
  const seen = new Set<string>();
  for (const t of section.getAllTextNodes()) {
    const block = $getNearestBlockElementAncestorOrThrow(t);
    const key = block.getKey();
    if (!seen.has(key)) {
      seen.add(key);
      blocks.push({ key, text: block.getTextContent() });
    }
  }
  return blocks;
}

/** Range between two points, snapped to word edges and split by block. */
function rangeHitsFromPoints(
  editor: LexicalEditor,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): BlockHit[] {
  const a = pointToBlockOffset(editor, x1, y1);
  const b = pointToBlockOffset(editor, x2, y2);
  if (!a || !b) return [];
  if (a.sectionKey !== b.sectionKey) {
    const fallback = wordHitFromPoint(editor, x2, y2);
    return fallback ? [fallback] : [];
  }

  if (a.blockKey === b.blockKey) {
    const [start, end] = expandToWordRange(
      a.blockText,
      a.charIndex,
      b.charIndex
    );
    return start === end ? [] : [{ blockKey: a.blockKey, start, end }];
  }

  const hits: BlockHit[] = [];
  editor.read(() => {
    const blocks = $sectionBlocksInOrder(a.sectionKey);
    const ai = blocks.findIndex((blk) => blk.key === a.blockKey);
    const bi = blocks.findIndex((blk) => blk.key === b.blockKey);
    if (ai === -1 || bi === -1) return;

    const [from, to] = ai <= bi ? [a, b] : [b, a];
    const lo = Math.min(ai, bi);
    const hi = Math.max(ai, bi);

    for (let i = lo; i <= hi; i++) {
      const blk = blocks[i]!;
      if (blk.text.length === 0) continue;
      let start: number;
      let end: number;
      if (i === lo && i === hi) {
        [start, end] = expandToWordRange(blk.text, from.charIndex, to.charIndex);
      } else if (i === lo) {
        const [s] = expandToWord(blk.text, from.charIndex);
        start = s;
        end = blk.text.length;
        // Trim trailing non-word on partial first block? Keep through end of block.
        while (end > start && !isWordChar(blk.text[end - 1]!)) end--;
      } else if (i === hi) {
        const [, e] = expandToWord(blk.text, to.charIndex);
        start = 0;
        while (start < e && !isWordChar(blk.text[start]!)) start++;
        end = e;
      } else {
        start = 0;
        end = blk.text.length;
        while (start < end && !isWordChar(blk.text[start]!)) start++;
        while (end > start && !isWordChar(blk.text[end - 1]!)) end--;
      }
      if (start < end) {
        hits.push({ blockKey: blk.key, start, end });
      }
    }
  });
  return hits;
}

function domTextNodeIn(el: Element | null): Text | null {
  if (!el) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}

/** Measure a block range for teacher-only overlay previews. */
type OverlayMeasure = {
  rects: DOMRect[];
  text: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
};

function computeOverlayMeasure(
  editor: LexicalEditor,
  blockKey: string,
  start: number,
  end: number
): OverlayMeasure | null {
  let measure: OverlayMeasure | null = null;
  editor.read(() => {
    const block = $getNodeByKey(blockKey);
    if (!$isElementNode(block)) return;
    const blockEl = editor.getElementByKey(blockKey);
    if (!blockEl) return;

    const lexicalTexts = block.getAllTextNodes();
    const domTexts: Text[] = [];
    for (const t of lexicalTexts) {
      const el = editor.getElementByKey(t.getKey());
      const text = domTextNodeIn(el);
      if (!text) return;
      domTexts.push(text);
    }

    let acc = 0;
    let startNode: Text | null = null;
    let startOff = 0;
    let endNode: Text | null = null;
    let endOff = 0;
    for (let i = 0; i < lexicalTexts.length; i++) {
      const len = lexicalTexts[i]!.getTextContentSize();
      const dom = domTexts[i]!;
      if (!startNode && start <= acc + len) {
        startNode = dom;
        startOff = Math.min(Math.max(0, start - acc), dom.length);
      }
      if (end <= acc + len) {
        endNode = dom;
        endOff = Math.min(Math.max(0, end - acc), dom.length);
        break;
      }
      acc += len;
    }
    if (!startNode || !endNode) {
      const last = domTexts[domTexts.length - 1];
      if (!last) return;
      if (!startNode) {
        startNode = last;
        startOff = last.length;
      }
      if (!endNode) {
        endNode = last;
        endOff = last.length;
      }
    }

    try {
      const range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      const rects = Array.from(range.getClientRects())
        .filter((r) => r.width > 0 || r.height > 0)
        .map((r) => new DOMRect(r.x, r.y, r.width, r.height));
      if (rects.length === 0) return;

      const styleEl =
        startNode.parentElement ?? endNode.parentElement ?? blockEl;
      const cs = getComputedStyle(styleEl);
      measure = {
        rects,
        text: range.toString(),
        color: cs.color || "var(--color-editor-ink)",
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        lineHeight: cs.lineHeight,
      };
    } catch {
      measure = null;
    }
  });
  return measure;
}

/** Teacher-only preview lift so marked words read slightly above the base text. */
const MARK_UP_LIFT_PX = 3;

/** Clone the underlying glyphs so hover/pending look like real formatting. */
function toolCloneStyle(
  tools: LockedMarkUpTool[],
  base: Pick<
    OverlayMeasure,
    "color" | "fontFamily" | "fontSize" | "fontWeight" | "fontStyle"
  >,
  /** Match the glyph rect — body `leading-relaxed` would otherwise push glyphs down. */
  rectHeight: number
): CSSProperties {
  const shared: CSSProperties = {
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    // Use the measured glyph box, not the paragraph line-height.
    lineHeight: `${rectHeight}px`,
    fontWeight: base.fontWeight,
    fontStyle: base.fontStyle,
    color: base.color,
    whiteSpace: "pre",
    overflow: "hidden",
    backgroundColor: "var(--color-editor-canvas)",
  };
  if (tools.some((tool) => tool.kind === "eraser")) {
    return {
      ...shared,
      opacity: 0.55,
      textDecoration: "line-through",
    };
  }

  const next = { ...shared };
  for (const tool of tools) {
    if (tool.kind === "bold") next.fontWeight = 700;
    if (tool.kind === "italic") next.fontStyle = "italic";
    if (tool.kind === "color") next.color = tool.color ?? base.color;
    if (tool.kind === "highlight") {
      next.backgroundColor = tool.color ?? "#ffe599";
    }
  }
  return next;
}

function squiggleBackground(color: string): string {
  const stroke = encodeURIComponent(color);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3' viewBox='0 0 6 3'%3E%3Cpath d='M0 2.1 C1 0.3 2 0.3 3 2.1 C4 3.9 5 3.9 6 2.1' fill='none' stroke='${stroke}' stroke-width='1.15' stroke-linecap='round'/%3E%3C/svg%3E")`;
}

type FormatOverlayLayer = {
  key: string;
  measure: OverlayMeasure;
  tools: LockedMarkUpTool[];
  /** Spellcheck-style underline for queued (not-yet-shared) marks. */
  squiggle: boolean;
};

function FormatOverlay({
  layer,
}: {
  layer: FormatOverlayLayer;
}) {
  const { measure, tools, squiggle } = layer;
  const primary = measure.rects[0];
  if (!primary) return null;
  const cloneStyle = toolCloneStyle(tools, measure, primary.height);

  return (
    <>
      {/* Single-box text clone covers the common word-hover case cleanly. */}
      {measure.rects.length === 1 ? (
        <div
          className="absolute"
          style={{
            top: primary.top - MARK_UP_LIFT_PX,
            left: primary.left,
            width: Math.max(primary.width, 2),
            height: primary.height,
            borderRadius: 0,
            ...cloneStyle,
          }}
        >
          {measure.text}
        </div>
      ) : (
        measure.rects.map((r, i) => (
          <div
            key={`r-${i}`}
            className="absolute"
            style={{
              top: r.top - MARK_UP_LIFT_PX,
              left: r.left,
              width: Math.max(r.width, 2),
              height: r.height,
              borderRadius: 0,
              ...(tools.some((tool) => tool.kind === "highlight")
                ? {
                    backgroundColor:
                      tools.find((tool) => tool.kind === "highlight")?.color ??
                      "#ffe599",
                  }
                : tools.some((tool) => tool.kind === "color")
                  ? {
                      boxShadow: `inset 0 -2px 0 ${
                        tools.find((tool) => tool.kind === "color")?.color ??
                        measure.color
                      }`,
                      backgroundColor: "transparent",
                    }
                  : tools.some(
                        (tool) => tool.kind === "bold" || tool.kind === "italic"
                      )
                    ? {
                        backgroundColor: "var(--color-editor-canvas)",
                        boxShadow:
                          tools.some((tool) => tool.kind === "bold")
                            ? "inset 0 0 0 999px rgba(0,0,0,0.04)"
                            : "inset 0 0 0 999px rgba(0,0,0,0.02)",
                      }
                    : { backgroundColor: "rgba(0,0,0,0.06)" }),
            }}
          />
        ))
      )}
      {squiggle &&
        measure.rects.map((r, i) => (
          <div
            key={`sq-${i}`}
            className="absolute"
            aria-hidden
            style={{
              top: r.bottom - 1 - MARK_UP_LIFT_PX,
              left: r.left,
              width: Math.max(r.width, 2),
              height: 4,
              backgroundImage: squiggleBackground(measure.color),
              backgroundRepeat: "repeat-x",
              backgroundPosition: "left bottom",
              backgroundSize: "6px 3px",
            }}
          />
        ))}
    </>
  );
}

// --- Shared-doc apply (reveal / exit only) ----------------------------------

function readStyle(sel: RangeSel, prop: string): string {
  const nodes = sel.getNodes();
  for (const n of nodes) {
    if ($isTextNode(n)) {
      const style = n.getStyle();
      const m = new RegExp(`${prop}:\\s*([^;]+)`, "i").exec(style);
      if (m) return m[1]!.trim();
    }
  }
  return "";
}

const EMPTY_SNAPSHOT: MarkSnapshot = {
  applied: false,
  priorColor: "",
  priorBg: "",
};

/** Apply marks into the shared Lexical/Yjs doc. Clears the native selection afterward. */
function applyMarksToDoc(
  editor: LexicalEditor,
  marks: PendingMarkUpMark[]
): PendingMarkUpMark[] {
  const next: PendingMarkUpMark[] = [];
  editor.update(() => {
    for (const mark of marks) {
      if (mark.tool.kind === "eraser") {
        next.push(mark);
        continue;
      }
      const sel = $selectBlockRange(mark.blockKey, mark.start, mark.end);
      if (!sel) {
        next.push({ ...mark, snapshot: EMPTY_SNAPSHOT });
        continue;
      }
      let snapshot = EMPTY_SNAPSHOT;
      if (mark.tool.kind === "bold" || mark.tool.kind === "italic") {
        const already = sel.hasFormat(mark.tool.kind);
        if (!already) sel.formatText(mark.tool.kind);
        snapshot = { applied: !already, priorColor: "", priorBg: "" };
      } else if (mark.tool.kind === "color") {
        snapshot = {
          applied: false,
          priorColor: readStyle(sel, "color"),
          priorBg: "",
        };
        $patchStyleText(sel, { color: mark.tool.color ?? "#000000" });
      } else if (mark.tool.kind === "highlight") {
        snapshot = {
          applied: false,
          priorColor: "",
          priorBg: readStyle(sel, "background-color"),
        };
        $patchStyleText(sel, {
          "background-color": mark.tool.color ?? "#ffe599",
        });
      }
      next.push({ ...mark, snapshot });
    }
    $setSelection(null);
  });
  return next;
}

/** Revert marks that were previously written into the shared doc. */
function revertMarksFromDoc(
  editor: LexicalEditor,
  marks: PendingMarkUpMark[]
): void {
  if (marks.length === 0) return;
  editor.update(() => {
    for (const mark of marks) {
      const s = mark.snapshot;
      if (!s) continue;
      const sel = $selectBlockRange(mark.blockKey, mark.start, mark.end);
      if (!sel) continue;
      if (mark.tool.kind === "bold" || mark.tool.kind === "italic") {
        if (s.applied) sel.formatText(mark.tool.kind);
      } else if (mark.tool.kind === "color") {
        $patchStyleText(sel, { color: s.priorColor || null });
      } else if (mark.tool.kind === "highlight") {
        $patchStyleText(sel, { "background-color": s.priorBg || null });
      }
    }
    $setSelection(null);
  });
}

// --- Publish-bar toggle -----------------------------------------------------

export function MarkUpModeToggle() {
  const {
    active,
    toggle,
    pending,
    clearPending,
    revealed,
    setRevealed,
    setActiveTools,
  } = useMarkUpMode();
  const { highlightColor } = useEditorColors();
  const [editor] = useLexicalComposerContext();

  const onClick = () => {
    if (active) {
      if (revealed) {
        // Already in the shared doc — just drop local bookkeeping.
        clearPending();
      } else if (pending.length > 0) {
        // Commit teacher preview into the shared doc for everyone.
        applyMarksToDoc(editor, pending);
        clearPending();
      }
      setRevealed(false);
      toggle();
    } else {
      toggle();
      setActiveTools([{ kind: "highlight", color: highlightColor }]);
    }
  };

  return (
    <Button
      size="sm"
      aria-label={active ? "Exit Mark Up Mode" : "Enter Mark Up Mode"}
      variant={active ? "default" : "outline"}
      onClick={onClick}
      title={active ? "Exit Mark Up Mode and keep mark up" : "Enter Mark Up Mode"}
      className={cn(active && "bg-amber-700 text-white hover:bg-amber-800")}
    >
      <PencilRuler className="h-4 w-4" />
    </Button>
  );
}

// --- Editor frame while active ---------------------------------------------

export function MarkUpModeChrome({ children }: { children: ReactNode }) {
  const { active } = useMarkUpMode();
  const { vignetteColor } = useEditorColors();
  // Translucent variant of the (rgb) vignette color for the soft inner glow.
  const softVignette = vignetteColor
    .replace("rgb(", "rgba(")
    .replace(")", ", 0.5)");
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            boxShadow: `inset 0 0 0 6px ${vignetteColor}, inset 0 0 90px 16px ${softVignette}`,
          }}
        />
      )}
      {children}
    </div>
  );
}

// --- Floating tool palette (buttons only, top-center) -----------------------

function LockButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "editor-toolbar-btn border border-editor-chrome bg-white",
        active && "editor-toolbar-btn-active ring-2 ring-amber-500"
      )}
    >
      {children}
    </button>
  );
}

function ColorLockButton({
  kind,
  title,
  icon,
  defaultColor,
  onDefaultChange,
}: {
  kind: "color" | "highlight";
  title: string;
  icon: ReactNode;
  defaultColor: string;
  onDefaultChange: (color: string) => void;
}) {
  const { activeTools, setActiveTools } = useMarkUpMode();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeTool = activeTools.find((tool) => tool.kind === kind);
  const locked = !!activeTool;
  const swatch = activeTool?.color ?? defaultColor;

  const toggleColorTool = (color: string) => {
    setActiveTools((prev) =>
      locked
        ? prev.filter((tool) => tool.kind !== kind)
        : [
            ...prev.filter((tool) => tool.kind !== "eraser"),
            { kind, color },
          ]
    );
  };

  const setColorTool = (color: string) => {
    setActiveTools((prev) => [
      ...prev.filter((tool) => tool.kind !== kind && tool.kind !== "eraser"),
      { kind, color },
    ]);
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <CornerSplitButton
        title={title}
        dropdownTitle={`${title} — choose color`}
        active={locked}
        dropdownOpen={open}
        onMainClick={() => toggleColorTool(defaultColor)}
        onDropdownClick={() => setOpen((o) => !o)}
        className={cn(
          "border border-editor-chrome bg-white",
          locked && "ring-2 ring-amber-500"
        )}
        footer={
          <span
            className="absolute bottom-0.5 left-1/2 h-1 w-3.5 -translate-x-1/2 rounded-full"
            style={{ background: swatch }}
          />
        }
      >
        {icon}
      </CornerSplitButton>
      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={wrapRef}
        className="w-auto p-2"
      >
        <ColorPalette
          onPick={(color) => {
            onDefaultChange(color);
            setColorTool(color);
            setOpen(false);
          }}
          onClear={() => {
            setActiveTools((prev) => prev.filter((tool) => tool.kind !== kind));
            setOpen(false);
          }}
          clearLabel="Clear lock"
        />
      </ToolbarPopover>
    </div>
  );
}

export function MarkUpToolsFloat() {
  const {
    active,
    activeTools,
    setActiveTools,
    pending,
    clearPending,
    revealed,
    setRevealed,
    replacePending,
  } = useMarkUpMode();
  const { highlightColor, textColor, setHighlightColor, setTextColor } =
    useEditorColors();
  const [editor] = useLexicalComposerContext();

  const toggleLock = (kind: MarkUpToolKind) => {
    if (kind === "highlight") {
      setActiveTools((prev) =>
        prev.some((tool) => tool.kind === "highlight")
          ? prev.filter((tool) => tool.kind !== "highlight")
          : [
              ...prev.filter((tool) => tool.kind !== "eraser"),
              { kind: "highlight", color: highlightColor },
            ]
      );
      return;
    }
    if (kind === "color") {
      setActiveTools((prev) =>
        prev.some((tool) => tool.kind === "color")
          ? prev.filter((tool) => tool.kind !== "color")
          : [
              ...prev.filter((tool) => tool.kind !== "eraser"),
              { kind: "color", color: textColor },
            ]
      );
      return;
    }
    setActiveTools((prev) => {
      if (kind === "eraser") {
        return prev.some((tool) => tool.kind === "eraser")
          ? []
          : [{ kind: "eraser" }];
      }
      return prev.some((tool) => tool.kind === kind)
        ? prev.filter((tool) => tool.kind !== kind)
        : [...prev.filter((tool) => tool.kind !== "eraser"), { kind }];
    });
  };

  const isToolActive = (kind: MarkUpToolKind) =>
    activeTools.some((tool) => tool.kind === kind);

  const onReveal = () => {
    if (pending.length === 0) return;
    if (revealed) {
      // Hide from students: revert shared doc, keep teacher preview queue.
      revertMarksFromDoc(editor, pending);
      replacePending(
        pending.map(({ snapshot: _s, ...rest }) => rest)
      );
      setRevealed(false);
    } else {
      // Push preview into the shared doc so students see it.
      replacePending(applyMarksToDoc(editor, pending));
      setRevealed(true);
    }
  };

  const onClear = () => {
    const removed = clearPending();
    if (revealed) revertMarksFromDoc(editor, removed);
    setRevealed(false);
  };

  if (!active) return null;

  return (
    <div className="editor-float-palette absolute left-1/2 top-16 z-40 w-max -translate-x-1/2 border-amber-700/45 bg-white shadow-[0_6px_20px_rgba(34,29,21,0.1)]">
      <ColorLockButton
        kind="highlight"
        title="Highlight"
        icon={<Highlighter className="h-4 w-4" />}
        defaultColor={highlightColor}
        onDefaultChange={setHighlightColor}
      />
      <LockButton
        active={isToolActive("bold")}
        title="Bold"
        onClick={() => toggleLock("bold")}
      >
        <Bold className="h-4 w-4" />
      </LockButton>
      <LockButton
        active={isToolActive("italic")}
        title="Italic"
        onClick={() => toggleLock("italic")}
      >
        <Italic className="h-4 w-4" />
      </LockButton>
      <ColorLockButton
        kind="color"
        title="Text color"
        icon={<Baseline className="h-4 w-4" />}
        defaultColor={textColor}
        onDefaultChange={setTextColor}
      />
      <LockButton
        active={isToolActive("eraser")}
        title="Eraser — remove mark up"
        onClick={() => toggleLock("eraser")}
      >
        <Eraser className="h-4 w-4" />
      </LockButton>

      <span className="mx-1.5 h-7 w-px bg-amber-700/35" />

      <button
        type="button"
        title={
          revealed
            ? "Hide mark up from students"
            : "Show my mark up to students"
        }
        onMouseDown={(e) => e.preventDefault()}
        onClick={onReveal}
        disabled={pending.length === 0}
        className={cn(
          "editor-toolbar-btn border border-editor-chrome bg-white disabled:opacity-40",
          revealed &&
            pending.length > 0 &&
            "editor-toolbar-btn-active ring-2 ring-emerald-500"
        )}
      >
        <Eye className="h-4 w-4" />
      </button>
      <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
        {pending.length}
      </span>
      {pending.length > 0 && (
        <button
          type="button"
          title="Discard mark up"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="editor-toolbar-btn w-auto border border-editor-chrome bg-white px-2"
        >
          <span className="text-xs">Clear</span>
        </button>
      )}
    </div>
  );
}

// --- Hover / click / drag plugin -------------------------------------------

function hitsOverlapMark(hit: BlockHit, mark: PendingMarkUpMark): boolean {
  return (
    mark.blockKey === hit.blockKey &&
    mark.start < hit.end &&
    mark.end > hit.start
  );
}

export function MarkUpWordPlugin() {
  const [editor] = useLexicalComposerContext();
  const {
    active,
    activeTools,
    queueMark,
    removeMarksInRange,
    pending,
    revealed,
  } = useMarkUpMode();
  const [hoverHits, setHoverHitsState] = useState<BlockHit[]>([]);
  const [pendingLayers, setPendingLayers] = useState<FormatOverlayLayer[]>([]);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hoverHitsRef = useRef<BlockHit[]>([]);
  const pendingRef = useRef(pending);
  const revealedRef = useRef(revealed);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  const setHoverHits = useCallback((hits: BlockHit[]) => {
    hoverHitsRef.current = hits;
    setHoverHitsState(hits);
  }, []);

  const refreshPendingLayers = useCallback(() => {
    // Queued teacher mark up (not yet shared): show real format preview + squiggle.
    // Once revealed, Lexical owns the look — drop overlays so we don't double-paint.
    if (!active || revealed || pending.length === 0) {
      setPendingLayers([]);
      return;
    }
    const grouped = new Map<
      string,
      {
        blockKey: string;
        start: number;
        end: number;
        tools: LockedMarkUpTool[];
      }
    >();
    for (const mark of pending) {
      if (mark.tool.kind === "eraser") continue;
      const key = `${mark.blockKey}:${mark.start}:${mark.end}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.tools.push(mark.tool);
      } else {
        grouped.set(key, {
          blockKey: mark.blockKey,
          start: mark.start,
          end: mark.end,
          tools: [mark.tool],
        });
      }
    }

    const next: FormatOverlayLayer[] = [];
    for (const [key, group] of grouped) {
      const measure = computeOverlayMeasure(
        editor,
        group.blockKey,
        group.start,
        group.end
      );
      if (!measure) continue;
      next.push({
        key,
        measure,
        tools: group.tools,
        squiggle: true,
      });
    }
    setPendingLayers(next);
  }, [active, revealed, pending, editor]);

  useEffect(() => {
    refreshPendingLayers();
  }, [refreshPendingLayers]);

  useEffect(() => {
    if (!active) return;
    const surface = editor.getRootElement()?.closest(".editor-surface");
    const onScrollResize = () => {
      if (hoverHitsRef.current.length > 0) {
        setHoverHitsState([...hoverHitsRef.current]);
      }
      refreshPendingLayers();
    };
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    surface?.addEventListener("scroll", onScrollResize);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
      surface?.removeEventListener("scroll", onScrollResize);
    };
  }, [active, editor, refreshPendingLayers]);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHoverHits([]);
      return;
    }
    const root = editor.getRootElement();
    if (!root) return;

    const applyHits = (hits: BlockHit[]) => {
      if (activeTools.length === 0) return;
      const erasing = activeTools.some((tool) => tool.kind === "eraser");
      const toolsToApply = activeTools.filter((tool) => tool.kind !== "eraser");

      for (const hit of hits) {
        const overlapping = pendingRef.current.filter((m) =>
          hitsOverlapMark(hit, m)
        );

        // Eraser always clears; re-clicking a marked word also clears.
        if (erasing || overlapping.length > 0) {
          if (overlapping.length > 0) {
            if (revealedRef.current) {
              revertMarksFromDoc(editor, overlapping);
            }
            const removeIds = new Set(overlapping.map((m) => m.id));
            pendingRef.current = pendingRef.current.filter(
              (m) => !removeIds.has(m.id)
            );
            removeMarksInRange(hit.blockKey, hit.start, hit.end);
          }
          continue;
        }

        const drafts = toolsToApply.map((tool) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          blockKey: hit.blockKey,
          start: hit.start,
          end: hit.end,
          tool: { ...tool },
        }));

        // Already revealed → write into the shared doc so students see it too.
        // Otherwise keep it teacher-only until reveal / exit.
        if (revealedRef.current) {
          const applied = applyMarksToDoc(editor, drafts);
          pendingRef.current = [...pendingRef.current, ...applied];
          for (const mark of applied) queueMark(mark);
        } else {
          pendingRef.current = [...pendingRef.current, ...drafts];
          for (const mark of drafts) queueMark(mark);
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      try {
        if (dragRef.current) {
          const start = dragRef.current;
          if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 4) {
            start.moved = true;
          }
          const hits = start.moved
            ? rangeHitsFromPoints(editor, start.x, start.y, e.clientX, e.clientY)
            : (() => {
                const hit = wordHitFromPoint(editor, e.clientX, e.clientY);
                return hit ? [hit] : [];
              })();
          setHoverHits(hits);
          return;
        }
        const hit = wordHitFromPoint(editor, e.clientX, e.clientY);
        setHoverHits(hit ? [hit] : []);
      } catch {
        setHoverHits([]);
      }
    };

    const onLeave = () => setHoverHits([]);

    const onDown = (e: MouseEvent) => {
      if (activeTools.length === 0) return;
      e.preventDefault();
      dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    };

    const onUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (activeTools.length === 0) return;
      e.preventDefault();
      try {
        const hits =
          drag && drag.moved
            ? rangeHitsFromPoints(editor, drag.x, drag.y, e.clientX, e.clientY)
            : (() => {
                const hit = wordHitFromPoint(editor, e.clientX, e.clientY);
                return hit ? [hit] : [];
              })();
        if (hits.length > 0) applyHits(hits);
      } catch {
        /* ignore bad hits */
      }
      setHoverHits([]);
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("mousedown", onDown, true);
    root.addEventListener("mouseup", onUp, true);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("mousedown", onDown, true);
      root.removeEventListener("mouseup", onUp, true);
    };
  }, [
    active,
    editor,
    activeTools,
    queueMark,
    removeMarksInRange,
    setHoverHits,
  ]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const suppress = active && activeTools.length > 0;
    root.style.userSelect = suppress ? "none" : "";
    root.style.cursor = suppress ? "pointer" : "";
    return () => {
      root.style.userSelect = "";
      root.style.cursor = "";
    };
  }, [active, activeTools, editor]);

  const hoverLayers: FormatOverlayLayer[] = [];
  if (active && activeTools.length > 0) {
    const erasing = activeTools.some((tool) => tool.kind === "eraser");
    const previewTools = erasing
      ? ([{ kind: "eraser" }] as LockedMarkUpTool[])
      : activeTools;
    for (let i = 0; i < hoverHits.length; i++) {
      const hit = hoverHits[i]!;
      const alreadyMarked = pending.some((m) => hitsOverlapMark(hit, m));

      // Queued marks already show format + squiggle; click will remove them.
      if (alreadyMarked && !erasing) continue;
      // Eraser only previews over something that can be cleared.
      if (erasing && !alreadyMarked) continue;

      const measure = computeOverlayMeasure(
        editor,
        hit.blockKey,
        hit.start,
        hit.end
      );
      if (!measure) continue;
      hoverLayers.push({
        key: `hover-${i}-${hit.blockKey}-${hit.start}-${hit.end}`,
        measure,
        tools: previewTools,
        squiggle: false,
      });
    }
  }

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-30">
      {pendingLayers.map((layer) => (
        <FormatOverlay key={layer.key} layer={layer} />
      ))}
      {hoverLayers.map((layer) => (
        <FormatOverlay key={layer.key} layer={layer} />
      ))}
    </div>,
    document.body
  );
}
