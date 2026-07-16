"use client";

import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type TextFormatType,
} from "lexical";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $createParagraphNode } from "lexical";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import { $isListNode, ListNode } from "@lexical/list";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Undo2,
  Redo2,
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  FontFamilyPicker,
  TextColorButton,
  HighlightColorButton,
  HighlightBlockButton,
  SectionBackgroundButton,
  AlignmentPicker,
} from "./format-plugins";
import { ImageUploadButton } from "./image-plugin";
import { InsertTableButton } from "./table-tools";
import {
  ToolbarUiProvider,
  type ToolbarDock,
} from "./toolbar-ui";
import { ToolbarZoomControls } from "./present-mode";
import { cn } from "@/lib/utils";

function ToolbarGroup({
  vertical,
  children,
  full,
}: {
  vertical: boolean;
  children: React.ReactNode;
  full?: boolean;
}) {
  if (!vertical) return <>{children}</>;
  return (
    <div className={full ? "editor-toolbar-group-full" : "editor-toolbar-group"}>
      {children}
    </div>
  );
}

function ToolbarDivider({ vertical }: { vertical: boolean }) {
  if (!vertical) {
    return <Separator orientation="vertical" className="h-5" />;
  }
  return (
    <div className="editor-toolbar-group-full">
      <Separator orientation="horizontal" className="w-full" />
    </div>
  );
}

export type { ToolbarDock };
const DOCK_KEY = "lms-editor-toolbar-dock";

const BLOCK_OPTIONS: Array<{
  value: string;
  label: string;
  glyph: string;
  apply: () => void;
}> = [
  {
    value: "paragraph",
    label: "Text",
    glyph: "T",
    apply: () => $setBlocksType($getSelection(), () => $createParagraphNode()),
  },
  {
    value: "h1",
    label: "Heading 1",
    glyph: "H1",
    apply: () =>
      $setBlocksType($getSelection(), () => $createHeadingNode("h1")),
  },
  {
    value: "h2",
    label: "Heading 2",
    glyph: "H2",
    apply: () =>
      $setBlocksType($getSelection(), () => $createHeadingNode("h2")),
  },
  {
    value: "h3",
    label: "Heading 3",
    glyph: "H3",
    apply: () =>
      $setBlocksType($getSelection(), () => $createHeadingNode("h3")),
  },
  {
    value: "h4",
    label: "Heading 4",
    glyph: "H4",
    apply: () =>
      $setBlocksType($getSelection(), () => $createHeadingNode("h4")),
  },
];

function ToolBtn({
  title,
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "editor-toolbar-btn",
        active && "editor-toolbar-btn-active",
        className
      )}
    >
      {children}
    </button>
  );
}

function BlockTypeSelector({ compact = false }: { compact?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [block, setBlock] = useState("paragraph");

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          const element =
            anchor.getKey() === "root"
              ? anchor
              : anchor.getTopLevelElementOrThrow();
          if ($isHeadingNode(element)) {
            setBlock(element.getTag());
            return;
          }
          const list = $getNearestNodeOfType(anchor, ListNode);
          if ($isListNode(list)) {
            setBlock("paragraph");
            return;
          }
          setBlock("paragraph");
        });
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);

  const active = BLOCK_OPTIONS.find((o) => o.value === block) ?? BLOCK_OPTIONS[0];
  const triggerLabel = block === "paragraph" ? "T" : compact ? "H" : `H${block.replace("h", "")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Block type: ${active.label}`}
          aria-label={`Block type: ${active.label}`}
          onMouseDown={(e) => e.preventDefault()}
          className="editor-toolbar-btn flex-nowrap whitespace-nowrap font-serif text-[13px] font-semibold leading-none data-[state=open]:bg-accent"
        >
          {triggerLabel}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 border bg-popover shadow-lg">
        <DropdownMenuLabel>Turn into</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BLOCK_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => {
              editor.update(() => opt.apply());
              setBlock(opt.value);
            }}
            className={cn(block === opt.value && "bg-accent")}
          >
            <span className="w-6 font-mono text-xs text-muted-foreground">
              {opt.glyph}
            </span>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineFormatButtons() {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          setActive({
            bold: selection.hasFormat("bold"),
            italic: selection.hasFormat("italic"),
            underline: selection.hasFormat("underline"),
            strikethrough: selection.hasFormat("strikethrough"),
          });
        });
      })
    );
  }, [editor]);

  const toggle = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const items: Array<{ format: TextFormatType; title: string; Icon: LucideIcon }> = [
    { format: "bold", title: "Bold", Icon: Bold },
    { format: "italic", title: "Italic", Icon: Italic },
    { format: "underline", title: "Underline", Icon: Underline },
    { format: "strikethrough", title: "Strikethrough", Icon: Strikethrough },
  ];

  return (
    <>
      {items.map(({ format, title, Icon }) => (
        <ToolBtn
          key={format}
          title={title}
          active={active[format]}
          onClick={() => toggle(format)}
        >
          <Icon className="h-4 w-4" />
        </ToolBtn>
      ))}
    </>
  );
}

function HistoryButtons() {
  const [editor] = useLexicalComposerContext();
  return (
    <>
      <ToolBtn
        title="Undo"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <Undo2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Redo"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <Redo2 className="h-4 w-4" />
      </ToolBtn>
    </>
  );
}

function DockPicker({
  dock,
  onChange,
  vertical,
}: {
  dock: ToolbarDock;
  onChange: (dock: ToolbarDock) => void;
  vertical: boolean;
}) {
  const options: Array<{ value: ToolbarDock; label: string; Icon: LucideIcon }> =
    [
      { value: "top", label: "Top", Icon: PanelTop },
      { value: "right", label: "Right", Icon: PanelRight },
      { value: "bottom", label: "Bottom", Icon: PanelBottom },
      { value: "left", label: "Left", Icon: PanelLeft },
    ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Toolbar position"
          aria-label="Toolbar position"
          onMouseDown={(e) => e.preventDefault()}
          className="editor-toolbar-btn data-[state=open]:bg-accent"
        >
          {dock === "top" && <PanelTop className="h-4 w-4" />}
          {dock === "bottom" && <PanelBottom className="h-4 w-4" />}
          {dock === "left" && <PanelLeft className="h-4 w-4" />}
          {dock === "right" && <PanelRight className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={vertical ? "left" : "bottom"}
        align="start"
        className="w-40 bg-popover"
      >
        <DropdownMenuLabel>Toolbar position</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={dock}
          onValueChange={(v) => onChange(v as ToolbarDock)}
        >
          {options.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="mr-1 h-3.5 w-3.5" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useToolbarDock(): [ToolbarDock, (d: ToolbarDock) => void] {
  const [dock, setDockState] = useState<ToolbarDock>("right");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DOCK_KEY) as ToolbarDock | null;
      if (saved && ["top", "bottom", "left", "right"].includes(saved)) {
        setDockState(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setDock = (next: ToolbarDock) => {
    setDockState(next);
    try {
      window.localStorage.setItem(DOCK_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return [dock, setDock];
}

export function EditorToolbar({
  classId,
  backLink,
  toolbarRight,
  dock,
  onDockChange,
  zoom,
  onZoomChange,
  isFullscreen,
  onToggleFullscreen,
}: {
  classId: string;
  backLink?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  dock: ToolbarDock;
  onDockChange: (dock: ToolbarDock) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const vertical = dock === "left" || dock === "right";

  return (
    <ToolbarUiProvider dock={dock}>
      <div
        className={cn(
          vertical ? "editor-toolbar-vertical" : "editor-toolbar-horizontal",
          dock === "bottom" && !vertical && "border-b-0 border-t",
          vertical && dock === "left" && "border-r",
          vertical && dock === "right" && "border-l"
        )}
      >
        {backLink && (
          <ToolbarGroup vertical={vertical} full={vertical}>
            {backLink}
          </ToolbarGroup>
        )}

        <ToolbarGroup vertical={vertical}>
          <BlockTypeSelector compact={vertical} />
          <FontFamilyPicker compact={vertical} />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical}>
          <InlineFormatButtons />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical} full={vertical}>
          <AlignmentPicker />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical}>
          <TextColorButton />
          <HighlightColorButton />
          <HighlightBlockButton />
          <SectionBackgroundButton />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical}>
          <ImageUploadButton classId={classId} />
          <InsertTableButton />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical}>
          <HistoryButtons />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical}>
          <ToolbarZoomControls
            zoom={zoom}
            onZoomChange={onZoomChange}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            compact={vertical}
          />
        </ToolbarGroup>

        <ToolbarDivider vertical={vertical} />

        <ToolbarGroup vertical={vertical} full={vertical}>
          <DockPicker dock={dock} onChange={onDockChange} vertical={vertical} />
        </ToolbarGroup>

        {toolbarRight && !vertical && (
          <div className="ml-auto flex items-center gap-2 pl-2">
            {toolbarRight}
          </div>
        )}
      </div>
    </ToolbarUiProvider>
  );
}