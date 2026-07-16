"use client";

import { useMemo, type ReactNode } from "react";
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
import { TABLE } from "./table-markdown";
import { SECTION_SEPARATOR } from "./section-separator-markdown";
import { SectionAwareMarkdownShortcutPlugin } from "./section-aware-markdown-plugin";
import { ImageNode } from "./image-node";
import { EditorSectionNode } from "./editor-section-node";
import { SectionSeparatorNode } from "./section-separator-node";
import { SectionStylePlugin } from "./format-plugins";
import { ListExitPlugin } from "./list-exit-plugin";
import {
  EditorToolbar,
  useToolbarDock,
} from "./editor-toolbar";
import { usePresentMode } from "./present-mode";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex h-64 items-center justify-center text-[#6b6558]">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading editor…
    </div>
  );
}

function EditorInner({
  classId,
  markdownSource,
  readOnly,
  backHref,
  toolbarRight,
}: {
  classId: string;
  markdownSource: string | null;
  readOnly?: boolean;
  backHref?: string;
  toolbarRight?: ReactNode;
}) {
  const { zoom, setZoom, isFullscreen, toggleFullscreen } = usePresentMode();
  const isReady = useIsEditorReady();
  const [dock, setDock] = useToolbarDock();
  const vertical = dock === "left" || dock === "right";

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
            ul: "list-disc ml-6 mb-2",
            ol: "list-decimal ml-6 mb-2",
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
      toolbarRight={vertical ? undefined : toolbarRight}
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
      {!vertical && toolbarRight && (
        <div className="ml-auto">{toolbarRight}</div>
      )}
    </div>
  );

  const floatingControls =
    vertical && toolbarRight ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center",
            dock === "left" ? "pl-[var(--editor-toolbar-rail)]" : "pr-[var(--editor-toolbar-rail)]"
          )}
        >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-editor-chrome bg-editor-canvas/95 px-3 py-1.5 shadow-md backdrop-blur">
          {toolbarRight}
        </div>
      </div>
    ) : null;

  const editorPane = (
    <div
      className="editor-surface transition-transform origin-top"
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
          <div className="pointer-events-none absolute top-8 left-[var(--content-pad)] text-muted-foreground">
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
      {!readOnly && (
        <>
          <SectionAwareMarkdownShortcutPlugin
            transformers={ELEMENT_TRANSFORMERS}
          />
          <MarkdownShortcutPlugin transformers={TEXT_TRANSFORMERS} />
        </>
      )}
      <SeedMarkdownPlugin markdown={markdownSource} />
    </div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ClassLiveblocksPlugin>
        <div
          className={cn(
            "flex min-h-[calc(100vh-0px)]",
            vertical ? "flex-row" : "flex-col"
          )}
        >
          {(dock === "top" || dock === "left") && toolbar}
          {editorPane}
          {(dock === "bottom" || dock === "right") && toolbar}
        </div>
        {floatingControls}
      </ClassLiveblocksPlugin>
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
}: {
  roomId: string;
  classId: string;
  markdownSource: string | null;
  shareToken?: string;
  readOnly?: boolean;
  backHref?: string;
  toolbarRight?: ReactNode;
}) {
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
      <RoomProvider id={roomId}>
        <ClientSideSuspense fallback={<EditorSkeleton />}>
          <EditorInner
            classId={classId}
            markdownSource={markdownSource}
            readOnly={readOnly}
            backHref={backHref}
            toolbarRight={toolbarRight}
          />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
