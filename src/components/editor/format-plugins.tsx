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
  FORMAT_ELEMENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type RangeSelection,
  type ElementNode,
  type ElementFormatType,
} from "lexical";
import {
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import { $getNearestBlockElementAncestorOrThrow, mergeRegister } from "@lexical/utils";
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
import { ColorPickerPopover, ColorPalette } from "./color-picker";
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
import { useToolbarUi, ToolbarPopover } from "./toolbar-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Keeps the last real range selection alive so toolbar popovers (color
 * pickers, font menu) still know what to style after the editor loses focus.
 */
export function useStyledSelection() {
  const [editor] = useLexicalComposerContext();
  const savedSelection = useRef<RangeSelection | null>(null);
  const [styles, setStyles] = useState<Record<string, string>>({});

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          savedSelection.current = sel.clone();
          setStyles({
            color: $getSelectionStyleValueForProperty(sel, "color", ""),
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
    (fn: (selection: RangeSelection) => void) => {
      editor.update(() => {
        let sel = $getSelection();
        if (!$isRangeSelection(sel) && savedSelection.current) {
          try {
            $setSelection(savedSelection.current.clone());
            sel = $getSelection();
          } catch {
            return;
          }
        }
        if ($isRangeSelection(sel)) fn(sel);
      });
    },
    [editor]
  );

  return { withSelection, styles };
}

function forEachSelectedBlock(
  sel: RangeSelection,
  fn: (block: ElementNode) => void
) {
  const blocks = new Set<ElementNode>();
  for (const node of sel.getNodes()) {
    try {
      const block = $getNearestBlockElementAncestorOrThrow(node);
      if ($isElementNode(block)) blocks.add(block);
    } catch {
      // node without a block ancestor — skip
    }
  }
  for (const block of blocks) fn(block);
}

/* ------------------------------------------------------------------ */
/* Text color & highlight                                              */
/* ------------------------------------------------------------------ */

export function TextColorButton() {
  const { withSelection, styles } = useStyledSelection();
  return (
    <ColorPickerPopover
      name="Text color"
      icon={<Baseline className="h-4 w-4" />}
      active={styles.color || null}
      onPick={(color) => withSelection((sel) => $patchStyleText(sel, { color }))}
      onClear={() =>
        withSelection((sel) => $patchStyleText(sel, { color: null }))
      }
      clearLabel="Default color"
    />
  );
}

export function HighlightColorButton() {
  const { withSelection, styles } = useStyledSelection();
  return (
    <ColorPickerPopover
      name="Highlight color"
      icon={<Highlighter className="h-4 w-4" />}
      active={styles.background || null}
      onPick={(color) =>
        withSelection((sel) =>
          $patchStyleText(sel, { "background-color": color })
        )
      }
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

/** Single dropdown showing the current alignment of the selected text. */
export function AlignmentPicker() {
  const [editor] = useLexicalComposerContext();
  const { dock, vertical } = useToolbarUi();
  const { withSelection } = useStyledSelection();
  const [active, setActive] = useState<ElementFormatType>("left");

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
      // The dropdown steals focus, so restore the saved selection instead of
      // relying on FORMAT_ELEMENT_COMMAND reading the live one.
      withSelection((sel) => {
        forEachSelectedBlock(sel, (block) => {
          block.getWritable().setFormat(format);
        });
      });
    }
    setActive(format);
  };

  const current = ALIGNMENTS.find((a) => a.format === active) ?? ALIGNMENTS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Alignment: ${current.label}`}
          aria-label={`Alignment: ${current.label}`}
          onMouseDown={(e) => e.preventDefault()}
          className="editor-toolbar-btn data-[state=open]:bg-accent"
        >
          <CurrentIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={vertical ? (dock === "left" ? "right" : "left") : "bottom"}
        align="start"
        className="w-40 bg-popover"
      >
        {ALIGNMENTS.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            onSelect={() => apply(format)}
            className={cn(active === format && "bg-accent")}
          >
            <Icon className="mr-1 h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Font family                                                         */
/* ------------------------------------------------------------------ */

const FONTS: Array<{ label: string; value: string | null }> = [
  { label: "Default", value: null },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Lobster", value: "Lobster, cursive" },
];

function currentFontLabel(font: string): string {
  if (!font) return "Font";
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
            style={font.value ? { fontFamily: font.value } : undefined}
          >
            {font.label}
          </button>
        ))}
      </ToolbarPopover>
    </div>
  );
}
