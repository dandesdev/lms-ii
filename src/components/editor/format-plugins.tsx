"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $setSelection,
  $isElementNode,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  TextNode,
  type BaseSelection,
  type RangeSelection,
  type ElementNode,
  type ElementFormatType,
} from "lexical";
import {
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import { $getNearestBlockElementAncestorOrThrow, mergeRegister } from "@lexical/utils";
import { $isTableSelection, type TableSelection } from "@lexical/table";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  ChevronDown,
  Highlighter,
  PaintBucket,
  Square,
} from "lucide-react";
import {
  ColorPickerPopover,
  ColorPalette,
  CornerSplitButton,
  SplitColorButton,
} from "./color-picker";
import { useEditorColors } from "./editor-colors-context";
import { $isImageNode } from "./image-node";
import {
  applyBlockVisualToDom,
  applySectionVisualToDom,
  parseBlockVisualStyle,
  serializeBlockVisualStyle,
  type BlockVisualStyle,
} from "./block-style";
import { $isEditorSectionNode } from "./editor-section-node";
import { $applySectionBackgroundAtCursor } from "./section-utils";
import { ToolbarPopover } from "./toolbar-ui";
import { cn } from "@/lib/utils";

/** Default ink written onto TextNode styles (and shown by the color tool). */
export const DEFAULT_TEXT_COLOR = "#000000";

function textStyleHasColor(style: string): boolean {
  return /(?:^|;)\s*color\s*:/i.test(style);
}

function $isTextStylingSelection(
  sel: BaseSelection | null
): sel is RangeSelection | TableSelection {
  return $isRangeSelection(sel) || $isTableSelection(sel);
}

/**
 * Keeps the last real range/table selection alive so toolbar popovers (color
 * pickers, font menu) still know what to style after the editor loses focus.
 */
export function useStyledSelection() {
  const [editor] = useLexicalComposerContext();
  const savedSelection = useRef<RangeSelection | TableSelection | null>(null);
  const [styles, setStyles] = useState<Record<string, string>>({});

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();
        if ($isTextStylingSelection(sel)) {
          savedSelection.current = sel.clone();
          setStyles({
            color: $getSelectionStyleValueForProperty(
              sel,
              "color",
              DEFAULT_TEXT_COLOR
            ),
            background: $getSelectionStyleValueForProperty(
              sel,
              "background-color",
              ""
            ),
            font: $getSelectionStyleValueForProperty(sel, "font-family", ""),
          });
        }
      });
    });
  }, [editor]);

  const withSelection = useCallback(
    (fn: (selection: RangeSelection | TableSelection) => void) => {
      editor.update(() => {
        let sel = $getSelection();
        // Restore the last usable selection if focus was lost (null) or the
        // current selection can't be styled. Never replace an active
        // TableSelection with an older RangeSelection — that was dropping
        // multi-cell formatting down to the drag-start cell only.
        if (!$isTextStylingSelection(sel) && savedSelection.current) {
          try {
            $setSelection(savedSelection.current.clone());
            sel = $getSelection();
          } catch {
            return;
          }
        }
        if ($isTextStylingSelection(sel)) fn(sel);
      });
    },
    [editor]
  );

  return { withSelection, styles };
}

function forEachSelectedBlock(
  sel: RangeSelection | TableSelection,
  fn: (block: ElementNode) => void
) {
  const blocks = new Set<ElementNode>();
  for (const node of sel.getNodes()) {
    try {
      if ($isElementNode(node) && node.getType() === "tablerow") continue;
      const block = $getNearestBlockElementAncestorOrThrow(
        $isElementNode(node) && node.getType() === "tablecell"
          ? node.getFirstChild() ?? node
          : node
      );
      if ($isElementNode(block)) blocks.add(block);
    } catch {
      // node without a block ancestor — skip
    }
  }
  // Table cells: also walk every text-bearing block inside each selected cell.
  if ($isTableSelection(sel)) {
    for (const node of sel.getNodes()) {
      if (node.getType() !== "tablecell" || !$isElementNode(node)) continue;
      for (const t of node.getAllTextNodes()) {
        try {
          const block = $getNearestBlockElementAncestorOrThrow(t);
          if ($isElementNode(block)) blocks.add(block);
        } catch {
          /* skip */
        }
      }
    }
  }
  for (const block of blocks) fn(block);
}

/* ------------------------------------------------------------------ */
/* Text color & highlight                                              */
/* ------------------------------------------------------------------ */

export function TextColorButton() {
  const { withSelection } = useStyledSelection();
  const { textColor, setTextColor } = useEditorColors();
  return (
    <SplitColorButton
      name="Text color"
      icon={<Baseline className="h-4 w-4" />}
      defaultColor={textColor}
      onApply={(color) => withSelection((sel) => $patchStyleText(sel, { color }))}
      onDefaultChange={setTextColor}
      onClear={() =>
        withSelection((sel) =>
          $patchStyleText(sel, { color: DEFAULT_TEXT_COLOR })
        )
      }
      clearLabel="Default (black)"
    />
  );
}

/**
 * Ensure every TextNode carries an explicit `color: #000000` when none is set,
 * so the color tool underline and Yjs state match the visible default ink.
 */
export function DefaultTextColorPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(TextNode, (node) => {
      const style = node.getStyle();
      if (textStyleHasColor(style)) return;
      node.setStyle(
        style
          ? `${style};color: ${DEFAULT_TEXT_COLOR}`
          : `color: ${DEFAULT_TEXT_COLOR}`
      );
    });
  }, [editor]);

  return null;
}

export function HighlightColorButton() {
  const { withSelection } = useStyledSelection();
  const { highlightColor, setHighlightColor } = useEditorColors();
  return (
    <SplitColorButton
      name="Highlight color"
      icon={<Highlighter className="h-4 w-4" />}
      defaultColor={highlightColor}
      onApply={(color) =>
        withSelection((sel) =>
          $patchStyleText(sel, { "background-color": color })
        )
      }
      onDefaultChange={setHighlightColor}
      onClear={() =>
        withSelection((sel) =>
          $patchStyleText(sel, { "background-color": null })
        )
      }
      clearLabel="No highlight"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Block visual styles (highlight block + full-bleed section bg)       */
/* ------------------------------------------------------------------ */

/**
 * Lexical's core ParagraphNode/HeadingNode keep `__style` in state (and sync
 * it over Yjs) but never render it to the DOM. This plugin mirrors our block
 * visual styles onto dirty element DOM nodes after each reconciliation.
 */
export function SectionStylePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements }) => {
      if (dirtyElements.size === 0) return;
      editorState.read(() => {
        for (const [key] of dirtyElements) {
          const node = $getNodeByKey(key);
          if (!$isElementNode(node)) continue;
          const dom = editor.getElementByKey(key);
          if (!dom) continue;
          if ($isEditorSectionNode(node)) {
            applySectionVisualToDom(dom, node.getStyle());
          } else {
            applyBlockVisualToDom(dom, node.getStyle());
          }
        }
      });
    });
  }, [editor]);

  return null;
}

/** Padded rounded "highlight block" — fill and/or border. */
export function HighlightBlockButton() {
  const { withSelection } = useStyledSelection();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"fill" | "border">("fill");
  const [activeFill, setActiveFill] = useState<string | null>(null);
  const [activeBorder, setActiveBorder] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const mutateHighlight = (
    patch: Pick<BlockVisualStyle, "highlightBg" | "highlightBorder">
  ) => {
    withSelection((sel) => {
      forEachSelectedBlock(sel, (block) => {
        const v = parseBlockVisualStyle(block.getStyle());
        const next: BlockVisualStyle = { ...v, ...patch };
        if ("highlightBg" in patch && patch.highlightBg === undefined) {
          delete next.highlightBg;
        }
        if (
          "highlightBorder" in patch &&
          patch.highlightBorder === undefined
        ) {
          delete next.highlightBorder;
        }
        block.getWritable().setStyle(serializeBlockVisualStyle(next));
      });
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Highlight block"
        aria-label="Highlight block"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "editor-toolbar-btn flex-col gap-0.5",
          open && "editor-toolbar-btn-active"
        )}
      >
        <Square className="h-4 w-4" />
        <span
          className="h-1 w-4 rounded-full border border-black/10"
          style={{
            backgroundColor: activeFill || "transparent",
            boxShadow: activeBorder
              ? `inset 0 0 0 1px ${activeBorder}`
              : undefined,
          }}
        />
      </button>

      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        className="w-[240px] p-3"
      >
          <div className="mb-2 flex gap-1 rounded-md bg-muted p-0.5">
            {(
              [
                ["fill", "Fill"],
                ["border", "Border"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode(id)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                  mode === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              mutateHighlight({
                highlightBg: undefined,
                highlightBorder: undefined,
              });
              // Force-clear both keys
              withSelection((sel) => {
                forEachSelectedBlock(sel, (block) => {
                  const v = parseBlockVisualStyle(block.getStyle());
                  block.getWritable().setStyle(
                    serializeBlockVisualStyle({ sectionBg: v.sectionBg })
                  );
                });
              });
              setActiveFill(null);
              setActiveBorder(null);
              setOpen(false);
            }}
            className="mb-2 w-full rounded-md border px-2 py-1 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent"
          >
            Clear highlight block
          </button>

          <ColorPalette
            clearLabel={mode === "fill" ? "No fill" : "No border"}
            onClear={() => {
              if (mode === "fill") {
                withSelection((sel) => {
                  forEachSelectedBlock(sel, (block) => {
                    const v = parseBlockVisualStyle(block.getStyle());
                    const next = { ...v };
                    delete next.highlightBg;
                    block
                      .getWritable()
                      .setStyle(serializeBlockVisualStyle(next));
                  });
                });
                setActiveFill(null);
              } else {
                withSelection((sel) => {
                  forEachSelectedBlock(sel, (block) => {
                    const v = parseBlockVisualStyle(block.getStyle());
                    const next = { ...v };
                    delete next.highlightBorder;
                    block
                      .getWritable()
                      .setStyle(serializeBlockVisualStyle(next));
                  });
                });
                setActiveBorder(null);
              }
            }}
            onPick={(color) => {
              if (mode === "fill") {
                mutateHighlight({ highlightBg: color });
                setActiveFill(color);
              } else {
                mutateHighlight({ highlightBorder: color });
                setActiveBorder(color);
              }
              setOpen(false);
            }}
          />
      </ToolbarPopover>
    </div>
  );
}

/** Full-bleed section background on the wrapper between `---` separators. */
export function SectionBackgroundButton() {
  const { withSelection } = useStyledSelection();

  const apply = useCallback(
    (color: string | null) => {
      withSelection(() => {
        $applySectionBackgroundAtCursor(color);
      });
    },
    [withSelection]
  );

  return (
    <ColorPickerPopover
      name="Section background"
      icon={<PaintBucket className="h-4 w-4" />}
      onPick={(color) => apply(color)}
      onClear={() => apply(null)}
      clearLabel="No section background"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

const ALIGNMENTS: Array<{
  format: ElementFormatType;
  label: string;
  icon: typeof AlignLeft;
}> = [
  { format: "left", label: "Align left", icon: AlignLeft },
  { format: "center", label: "Align center", icon: AlignCenter },
  { format: "right", label: "Align right", icon: AlignRight },
  { format: "justify", label: "Justify", icon: AlignJustify },
];

/** Normalizes Lexical's format value to one of the four toolbar options. */
function normalizeAlignment(format: ElementFormatType | ""): ElementFormatType {
  switch (format) {
    case "center":
    case "right":
    case "justify":
      return format;
    case "end":
      return "right";
    default:
      return "left";
  }
}

/** Cycle button for alignment; small arrow opens the full dropdown. */
export function AlignmentPicker() {
  const [editor] = useLexicalComposerContext();
  const { withSelection } = useStyledSelection();
  const [active, setActive] = useState<ElementFormatType>("left");
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = selection.anchor.getNode();
              const block = $isElementNode(node)
                ? node
                : node.getParent();
              if ($isElementNode(block)) {
                setActive(normalizeAlignment(block.getFormatType()));
              }
            } else if ($isNodeSelection(selection)) {
              const nodes = selection.getNodes();
              const image = nodes.find($isImageNode);
              if (image) setActive(normalizeAlignment(image.getAlign() || "left"));
            }
          });
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor]);

  const apply = (format: ElementFormatType) => {
    let imageOnly = false;
    editor.update(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection)) {
        const images = selection.getNodes().filter($isImageNode);
        if (images.length > 0) {
          imageOnly = true;
          for (const node of images) {
            node.setAlign(format === "justify" ? "center" : format);
          }
        }
      }
    });
    if (!imageOnly) {
      withSelection((sel) => {
        forEachSelectedBlock(sel, (block) => {
          block.getWritable().setFormat(format);
          // Align the list container too so markers move with the text.
          const parent = block.getParent();
          if (parent && parent.getType() === "list") {
            parent.getWritable().setFormat(format);
          }
        });
      });
    }
    setActive(format);
    setMenuOpen(false);
  };

  const cycle = () => {
    const idx = ALIGNMENTS.findIndex((a) => a.format === active);
    const next = ALIGNMENTS[(idx + 1) % ALIGNMENTS.length];
    apply(next.format);
  };

  const current = ALIGNMENTS.find((a) => a.format === active) ?? ALIGNMENTS[0];
  const CurrentIcon = current.icon;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <CornerSplitButton
        title={`${current.label} — click to cycle`}
        dropdownTitle="Choose alignment"
        dropdownOpen={menuOpen}
        onMainClick={cycle}
        onDropdownClick={() => setMenuOpen((o) => !o)}
      >
        <CurrentIcon className="h-4 w-4" />
      </CornerSplitButton>
      <ToolbarPopover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={rootRef}
        className="w-40 p-1"
      >
        {ALIGNMENTS.map(({ format, label, icon: Icon }) => (
          <button
            key={format}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(format)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
              active === format && "bg-accent"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </ToolbarPopover>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Font family                                                         */
/* ------------------------------------------------------------------ */

const FONTS: Array<{ label: string; value: string | null }> = [
  { label: "Inter", value: null },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Lobster", value: "Lobster, cursive" },
];

function currentFontLabel(font: string): string {
  if (!font) return "Inter";
  const match = FONTS.find((f) => f.value && font.includes(f.label));
  return match?.label ?? "Font";
}

export function FontFamilyPicker({ compact = false }: { compact?: boolean }) {
  const { withSelection, styles } = useStyledSelection();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const apply = (value: string | null) => {
    withSelection((sel) => $patchStyleText(sel, { "font-family": value }));
    setOpen(false);
  };

  const label = currentFontLabel(styles.font ?? "");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Font family"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "editor-toolbar-btn",
          compact ? "w-8" : "h-8 min-w-[84px] justify-between gap-1 px-2 text-sm",
          open && "editor-toolbar-btn-active"
        )}
      >
        {compact ? (
          <span className="font-serif text-sm font-semibold">Aa</span>
        ) : (
          <>
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </>
        )}
      </button>

      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        className="w-44 p-1"
      >
        {FONTS.map((font) => (
          <button
            key={font.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(font.value)}
            className={cn(
              "block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
              label === font.label && "bg-accent"
            )}
            style={
              font.value
                ? { fontFamily: font.value }
                : { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }
            }
          >
            {font.label}
          </button>
        ))}
      </ToolbarPopover>
    </div>
  );
}
