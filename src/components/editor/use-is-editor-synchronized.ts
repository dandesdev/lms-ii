"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useYjsProvider } from "@liveblocks/react/_private";

/**
 * Unlike `useIsEditorReady` (true during "synchronizing" too), this is only
 * true once Liveblocks Yjs has finished its initial bind — safe to mutate doc.
 */
export function useIsEditorSynchronized(): boolean {
  const yjsProvider = useYjsProvider();

  const getSnapshot = useCallback(
    () => yjsProvider?.getStatus() === "synchronized",
    [yjsProvider]
  );

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
