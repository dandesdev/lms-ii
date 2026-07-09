"use client";

import { useMemo } from "react";
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
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import {
  liveblocksConfig,
  LiveblocksPlugin,
  Toolbar,
  useIsEditorReady,
} from "@liveblocks/react-lexical";
import { SeedMarkdownPlugin } from "./seed-markdown-plugin";
import { ImageNode } from "./image-node";
import { ImageUploadButton } from "./image-plugin";
import { SectionBackgroundButton } from "./section-background";
import { PresentModeControls, usePresentMode } from "./present-mode";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
}: {
  classId: string;
  markdownSource: string | null;
  readOnly?: boolean;
}) {
  const { zoom, setZoom, toggleFullscreen } = usePresentMode();
  const isReady = useIsEditorReady();

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
        ],
        theme: {
          paragraph: "mb-2 leading-relaxed",
          heading: {
            h1: "text-3xl font-bold mb-4 mt-6",
            h2: "text-2xl font-semibold mb-3 mt-5",
            h3: "text-xl font-semibold mb-2 mt-4",
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
          },
        },
        onError: (error) => console.error(error),
      }),
    [readOnly]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <LiveblocksPlugin>
        <div className="sticky top-0 z-20 border-b border-[#e0d6c2] bg-[#fffdf8]/95 backdrop-blur">
          {!readOnly && (
            <Toolbar className="flex flex-wrap items-center gap-1 px-3 py-2">
              <Toolbar.BlockSelector />
              <Toolbar.Separator />
              <Toolbar.SectionInline />
              <Toolbar.Separator />
              <SectionBackgroundButton />
              <ImageUploadButton classId={classId} />
              <Toolbar.Separator />
              <PresentModeControls
                zoom={zoom}
                onZoomChange={setZoom}
                onToggleFullscreen={toggleFullscreen}
              />
              <Toolbar.Separator />
              <Toolbar.SectionHistory />
            </Toolbar>
          )}
          {readOnly && (
            <div className="flex items-center gap-2 px-3 py-2">
              <PresentModeControls
                zoom={zoom}
                onZoomChange={setZoom}
                onToggleFullscreen={toggleFullscreen}
              />
            </div>
          )}
        </div>

        <div
          className="mx-auto w-full max-w-4xl px-6 py-8 transition-transform origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {!isReady && <EditorSkeleton />}
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn(
                  "min-h-[60vh] outline-none",
                  !isReady && "opacity-0"
                )}
              />
            }
            placeholder={
              <div className="pointer-events-none absolute top-28 text-[#8a8272]">
                Start writing your class…
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TablePlugin />
          <SeedMarkdownPlugin markdown={markdownSource} />
        </div>
      </LiveblocksPlugin>
    </LexicalComposer>
  );
}

export function ClassEditor({
  roomId,
  classId,
  markdownSource,
  shareToken,
  readOnly,
}: {
  roomId: string;
  classId: string;
  markdownSource: string | null;
  shareToken?: string;
  readOnly?: boolean;
}) {
  return (
    <LiveblocksProvider
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
          />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
