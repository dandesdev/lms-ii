"use client";

/**
 * Liveblocks + Lexical collab without an early bootstrap write.
 *
 * Writing Section→Paragraph in `initialEditorState` then reseeding markdown in a
 * later update races Yjs incremental sync and can leave only separators / empty
 * sections. Empty rooms stay empty until SeedMarkdownPlugin (or EnsureEmptySection)
 * performs the first Lexical→Yjs write.
 */
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { useRoom, useSelf } from "@liveblocks/react";
import { useYjsProvider } from "@liveblocks/react/_private";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export function useIsEditorReady(): boolean {
  const yjsProvider = useYjsProvider();
  const getSnapshot = useCallback(() => {
    const status = yjsProvider?.getStatus();
    return status === "synchronizing" || status === "synchronized";
  }, [yjsProvider]);
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!yjsProvider) return () => {};
      yjsProvider.on("status", callback);
      return () => {
        yjsProvider.off("status", callback);
      };
    },
    [yjsProvider]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function ClassLiveblocksPlugin({
  children,
}: {
  children: ReactNode;
}) {
  const room = useRoom();
  const self = useSelf();
  const [cursorsEl, setCursorsEl] = useState<HTMLDivElement | null>(null);
  const cursorsContainerRef = useMemo(
    () => ({ current: cursorsEl }),
    [cursorsEl]
  );

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, unknown>) => {
      const provider = getYjsProviderForRoom(room, {}, true);
      yjsDocMap.set(id, provider.getYDoc());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return provider as any;
    },
    [room]
  );

  const username =
    typeof self?.info?.name === "string" ? self.info.name : "";
  const cursorColor =
    typeof self?.info?.color === "string" ? self.info.color : undefined;

  return (
    <>
      <div
        ref={setCursorsEl}
        className="lb-root lb-lexical-cursors"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          minWidth: "max-content",
          pointerEvents: "none",
        }}
      />
      {self && (
        <CollaborationPlugin
          id={room.id}
          providerFactory={providerFactory}
          username={username}
          cursorColor={cursorColor}
          cursorsContainerRef={cursorsContainerRef}
          // First document write comes from SeedMarkdownPlugin — do not bootstrap.
          shouldBootstrap={false}
        />
      )}
      {children}
    </>
  );
}
