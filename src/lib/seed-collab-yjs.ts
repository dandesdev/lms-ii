/**
 * Server-side markdown → Lexical → Yjs binary update for Liveblocks rooms.
 * Seeds empty rooms before clients connect (avoids client double-seed races).
 */
import { createHeadlessEditor } from "@lexical/headless";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import {
  createBinding,
  syncLexicalUpdateToYjs,
  type Provider,
} from "@lexical/yjs";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import {
  $createParagraphNode,
  $getRoot,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type LexicalNodeReplacement,
} from "lexical";
import * as Y from "yjs";
import { getLiveblocksClient } from "@/lib/liveblocks";
import { EditorSectionNode, $createEditorSectionNode } from "@/components/editor/editor-section-node";
import { SectionSeparatorNode } from "@/components/editor/section-separator-node";
import { SECTION_SEPARATOR } from "@/components/editor/section-separator-markdown";
import { TABLE } from "@/components/editor/table-markdown";
import { $normalizeRootIntoSections } from "@/components/editor/section-utils";

const SEED_TRANSFORMERS = [SECTION_SEPARATOR, TABLE, ...TRANSFORMERS];

const SEED_NODES: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  LinkNode,
  AutoLinkNode,
  EditorSectionNode,
  SectionSeparatorNode,
];

function createNoOpProvider(): Provider {
  const empty = () => {};
  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => new Map(),
      off: empty,
      on: empty,
      setLocalState: empty,
      setLocalStateField: empty,
    },
    connect: empty,
    disconnect: empty,
    off: empty,
    on: empty,
  };
}

function registerCollabSync(
  editor: LexicalEditor,
  provider: Provider,
  binding: ReturnType<typeof createBinding>
): () => void {
  return editor.registerUpdateListener(
    ({
      dirtyElements,
      dirtyLeaves,
      editorState,
      normalizedNodes,
      prevEditorState,
      tags,
    }) => {
      if (tags.has("skip-collab")) return;
      syncLexicalUpdateToYjs(
        binding,
        provider,
        prevEditorState,
        editorState,
        dirtyElements,
        dirtyLeaves,
        normalizedNodes,
        tags
      );
    }
  );
}

/** Build a Yjs binary update containing the markdown as Lexical section tree. */
export function encodeMarkdownAsLexicalYjsUpdate(
  markdown: string | null
): Uint8Array {
  const editor = createHeadlessEditor({
    namespace: "ClassEditorSeed",
    nodes: SEED_NODES,
    onError: (error) => {
      console.error("[seed-collab]", error);
    },
  });

  const id = "main";
  const doc = new Y.Doc();
  const docMap = new Map([[id, doc]]);
  const provider = createNoOpProvider();
  const binding = createBinding(editor, provider, id, doc, docMap);
  const unsubscribe = registerCollabSync(editor, provider, binding);

  try {
    editor.update(
      () => {
        if (markdown && markdown.trim()) {
          $convertFromMarkdownString(markdown, SEED_TRANSFORMERS);
          $normalizeRootIntoSections(true);
        } else {
          const root = $getRoot();
          root.clear();
          const section = $createEditorSectionNode();
          section.append($createParagraphNode());
          root.append(section);
        }
      },
      { discrete: true }
    );
    return Y.encodeStateAsUpdate(doc);
  } finally {
    unsubscribe();
    doc.destroy();
  }
}

function isLexicalRootEmpty(doc: Y.Doc): boolean {
  const root = doc.get("root", Y.XmlText);
  return root.length === 0;
}

async function roomYjsIsEmpty(roomId: string): Promise<boolean> {
  const liveblocks = getLiveblocksClient();
  try {
    const update = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId);
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, new Uint8Array(update));
      return isLexicalRootEmpty(doc);
    } finally {
      doc.destroy();
    }
  } catch {
    // Missing / empty Yjs doc → treat as empty
    return true;
  }
}

/**
 * Ensure the Liveblocks room exists and, if its Lexical Yjs root is empty,
 * seed it from markdown_source. Safe to call on every class page load.
 */
export async function ensureCollabRoomSeeded(
  roomId: string,
  markdown: string | null
): Promise<{ seeded: boolean }> {
  const liveblocks = getLiveblocksClient();

  await liveblocks.getOrCreateRoom(roomId, {
    defaultAccesses: ["room:write"],
  });

  const empty = await roomYjsIsEmpty(roomId);
  if (!empty) return { seeded: false };

  const yUpdate = encodeMarkdownAsLexicalYjsUpdate(markdown);
  await liveblocks.sendYjsBinaryUpdate(roomId, yUpdate);
  console.warn(`[seed-collab] seeded empty room ${roomId}`);
  return { seeded: true };
}
