"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import {
  HEADING,
  ORDERED_LIST,
  UNORDERED_LIST,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
} from "@lexical/markdown";
import { liveblocksConfig } from "@liveblocks/react-lexical";
import {
  ClassLiveblocksPlugin,
  useIsEditorReady,
} from "./class-liveblocks-plugin";
import { SeedMarkdownPlugin } from "./seed-markdown-plugin";
import { FontPreloadPlugin } from "./font-preload-plugin";
import { ClassBootCompleter } from "./class-boot-completer";
import { TABLE } from "./table-markdown";
import { SECTION_SEPARATOR } from "./section-separator-markdown";
import { SectionAwareMarkdownShortcutPlugin } from "./section-aware-markdown-plugin";
import { ImageNode } from "./image-node";
import { EditorSectionNode } from "./editor-section-node";
import { SectionSeparatorNode } from "./section-separator-node";
import { SectionStylePlugin, DefaultTextColorPlugin } from "./format-plugins";
import { ListExitPlugin } from "./list-exit-plugin";
import { SectionMergePlugin } from "./section-merge-plugin";
import {
  EditorToolbar,
  useToolbarDock,
} from "./editor-toolbar";
import { usePresentMode } from "./present-mode";
import { MarkUpModeProvider } from "./mark-up-mode-context";
import { EditorColorsProvider } from "./editor-colors-context";
import { MarkUpModeChrome } from "./mark-up-mode-chrome";
import { LiveblocksDisconnectOnHide } from "./liveblocks-disconnect-on-hide";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Waiting } from "@/components/waiting";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { EditorFontsBootstrap } from "./editor-fonts-bootstrap";

/** Teacher-only mark-up UI — loaded only when enableMarkUpMode is true. */
const MarkUpModeToggle = dynamic(
  () =>
    import("./mark-up-mode").then((m) => ({ default: m.MarkUpModeToggle })),
  { ssr: false }
);
const MarkUpToolsFloat = dynamic(
  () =>
    import("./mark-up-mode").then((m) => ({ default: m.MarkUpToolsFloat })),
  { ssr: false }
);
const MarkUpWordPlugin = dynamic(
  () =>
    import("./mark-up-mode").then((m) => ({ default: m.MarkUpWordPlugin })),
  { ssr: false }
);

const ELEMENT_TRANSFORMERS = [
  SECTION_SEPARATOR,
  TABLE,
  HEADING,
  ORDERED_LIST,
  UNORDERED_LIST,
];

const TEXT_TRANSFORMERS = [
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
];

function EditorSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Waiting kind="editor" variant="inline" />
    </div>
  );
}

function EditorInner({
  classId,
  markdownSource,
  readOnly,
  backHref,
  toolbarRight,
  enableMarkUpMode,
}: {
  classId: string;
  markdownSource: string | null;
  readOnly?: boolean;
  backHref?: string;
  toolbarRight?: ReactNode;
  enableMarkUpMode?: boolean;
}) {
  const { zoom, setZoom, isFullscreen, toggleFullscreen } = usePresentMode();
  const isReady = useIsEditorReady();
  const [dock, setDock] = useToolbarDock();
  const vertical = dock === "left" || dock === "right";

  const publishBar =
    enableMarkUpMode || toolbarRight ? (
      <div className="flex flex-wrap items-center gap-2">
        {enableMarkUpMode && <MarkUpModeToggle />}
        {enableMarkUpMode && toolbarRight && (
          <span className="h-6 w-px bg-border" aria-hidden="true" />
        )}
        {toolbarRight}
      </div>
    ) : null;
  const initialConfig = useMemo(
    () =>
      liveblocksConfig({
        namespace: "ClassEditor",
        editable: !readOnly,
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          TableNode,
          TableCellNode,
          TableRowNode,
          LinkNode,
          AutoLinkNode,
          ImageNode,
          EditorSectionNode,
          SectionSeparatorNode,
        ],
        theme: {
          paragraph: "mb-2 leading-relaxed",
          heading: {
            h1: "text-3xl font-bold mb-4 mt-6",
            h2: "text-2xl font-semibold mb-3 mt-5",
            h3: "text-xl font-semibold mb-2 mt-4",
            h4: "text-lg font-semibold mb-2 mt-3",
          },
          list: {
            ul: "list-disc mb-2",
            ol: "list-decimal mb-2",
            listitem: "mb-1",
          },
          text: {
            bold: "font-bold",
            italic: "italic",
            underline: "underline",
            strikethrough: "line-through",
            code: "rounded bg-accent px-1 py-0.5 font-mono text-[0.9em]",
          },
          table: "editor-table",
          tableCell: "editor-table-cell",
          tableCellHeader: "editor-table-header",
          tableRow: "",
          // Cell-range selection (drag across cells) paints via these classes.
          tableSelection: "editor-table-selection",
          tableCellSelected: "editor-table-cell-selected",
          sectionSeparator: "editor-section-separator",
          editorSection: "editor-section",
        },
        onError: (error) => {
          console.error("[ClassEditor]", error.message ?? error);
        },
      }),
    [readOnly]
  );

  const backLink = backHref ? (
    <Link
      href={backHref}
      prefetch
      title="Back"
      className="editor-toolbar-btn"
    >
      <ArrowLeft className="h-4 w-4" />
    </Link>
  ) : null;

  const toolbar = !readOnly ? (
    <EditorToolbar
      classId={classId}
      backLink={backLink}
      toolbarRight={vertical ? undefined : publishBar}
      dock={dock}
      onDockChange={setDock}
      zoom={zoom}
      onZoomChange={setZoom}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
    />
  ) : (
    <div
      className={cn(
        vertical ? "editor-toolbar-vertical w-auto" : "editor-toolbar-horizontal",
        vertical && dock === "left" && "border-r",
        vertical && dock === "right" && "border-l"
      )}
    >
      {backLink}
      {!vertical && publishBar && (
        <div className="ml-auto">{publishBar}</div>
      )}
    </div>
  );

  const floatingControls =
    vertical && publishBar ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center",
            dock === "left" ? "pl-(--editor-toolbar-rail)" : "pr-(--editor-toolbar-rail)"
          )}
        >
        <div className="pointer-events-auto editor-float-palette">
          {publishBar}
        </div>
      </div>
    ) : null;

  const editorSurface = (
      <div
        className="editor-surface min-h-0 flex-1 overflow-y-auto transition-transform origin-top"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        {!isReady && <EditorSkeleton />}
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn("editor-content", !isReady && "opacity-0")}
            />
          }
          placeholder={
            <div className="pointer-events-none absolute top-8 left-(--content-pad) text-muted-foreground">
              Start writing your class…
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        {!readOnly && <ListExitPlugin />}
        <TablePlugin />
        <SectionStylePlugin />
        <DefaultTextColorPlugin />
        <SectionMergePlugin />
        {enableMarkUpMode && <MarkUpWordPlugin />}
        {!readOnly && (
          <>
            <SectionAwareMarkdownShortcutPlugin
              transformers={ELEMENT_TRANSFORMERS}
            />
            <MarkdownShortcutPlugin transformers={TEXT_TRANSFORMERS} />
          </>
        )}
        <SeedMarkdownPlugin markdown={markdownSource} />
        <FontPreloadPlugin />
        <ClassBootCompleter />
      </div>
  );

  const editorPane = enableMarkUpMode ? (
    <MarkUpModeChrome>
      {editorSurface}
      <MarkUpToolsFloat />
    </MarkUpModeChrome>
  ) : (
    <div className="relative flex min-h-0 flex-1 flex-col">{editorSurface}</div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorColorsProvider>
        <MarkUpModeProvider>
          <ClassLiveblocksPlugin>
            <div
              className={cn(
                "flex h-screen min-h-0",
                vertical ? "flex-row" : "flex-col"
              )}
            >
              {(dock === "top" || dock === "left") && toolbar}
              {editorPane}
              {(dock === "bottom" || dock === "right") && toolbar}
            </div>
            {floatingControls}
          </ClassLiveblocksPlugin>
        </MarkUpModeProvider>
      </EditorColorsProvider>
    </LexicalComposer>
  );
}

export function ClassEditor({
  roomId,
  classId,
  markdownSource,
  shareToken,
  readOnly,
  backHref,
  toolbarRight,
  enableMarkUpMode,
}: {
  roomId: string;
  classId: string;
  markdownSource: string | null;
  shareToken?: string;
  readOnly?: boolean;
  backHref?: string;
  toolbarRight?: ReactNode;
  enableMarkUpMode?: boolean;
}) {
  const boot = useClassBoot();

  useEffect(() => {
    boot.advance("editor");
  }, [boot]);

  return (
    <LiveblocksProvider
      badgeLocation="bottom-left"
      authEndpoint={async (room) => {
        const res = await fetch("/api/liveblocks-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, shareToken }),
        });
        if (!res.ok) throw new Error("Auth failed");
        return res.json();
      }}
    >
      <EditorFontsBootstrap />
      <RoomProvider id={roomId}>
        <LiveblocksDisconnectOnHide />
        <ClientSideSuspense fallback={<EditorSkeleton />}>
          <EditorInner
            classId={classId}
            markdownSource={markdownSource}
            readOnly={readOnly}
            backHref={backHref}
            toolbarRight={toolbarRight}
            enableMarkUpMode={enableMarkUpMode}
          />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
