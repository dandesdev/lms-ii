"use client";

import {
  createContext,
  type Dispatch,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type SetStateAction,
  type ReactNode,
} from "react";

export type MarkUpToolKind =
  | "bold"
  | "italic"
  | "color"
  | "highlight"
  | "eraser";

export type LockedMarkUpTool = {
  kind: MarkUpToolKind;
  /** Used for color / highlight tools. */
  color?: string;
};

/** Per-mark bookkeeping when a mark has been pushed to the live (shared) doc. */
export type MarkSnapshot = {
  applied: boolean;
  priorColor: string;
  priorBg: string;
};

/**
 * A queued mark up, addressed by its block key plus absolute character offsets
 * within that block. Offsets survive text-node splits caused by applying other
 * marks, so the batch flush stays correct regardless of order.
 */
export type PendingMarkUpMark = {
  id: string;
  blockKey: string;
  start: number;
  end: number;
  tool: LockedMarkUpTool;
  /** Set only while the mark is written into the shared Lexical/Yjs doc. */
  snapshot?: MarkSnapshot;
};

type MarkUpModeContextValue = {
  active: boolean;
  activeTools: LockedMarkUpTool[];
  pending: PendingMarkUpMark[];
  /** True while pending marks are currently written into the shared doc (revealed). */
  revealed: boolean;
  toggle: () => void;
  setActive: (active: boolean) => void;
  setActiveTools: Dispatch<SetStateAction<LockedMarkUpTool[]>>;
  queueMark: (mark: Omit<PendingMarkUpMark, "id"> & { id?: string }) => void;
  removeMarksInRange: (
    blockKey: string,
    start: number,
    end: number
  ) => PendingMarkUpMark[];
  clearPending: () => PendingMarkUpMark[];
  replacePending: (marks: PendingMarkUpMark[]) => void;
  setRevealed: (revealed: boolean) => void;
};

const MarkUpModeContext = createContext<MarkUpModeContextValue | null>(null);

export function MarkUpModeProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  const [activeTools, setActiveTools] = useState<LockedMarkUpTool[]>([]);
  const [pending, setPending] = useState<PendingMarkUpMark[]>([]);
  const [revealed, setRevealed] = useState(false);

  // Activity preserves mark-up UI across navigations — exit mode while hidden.
  useLayoutEffect(() => {
    return () => {
      setActiveState(false);
      setActiveTools([]);
      setRevealed(false);
      setPending([]);
    };
  }, []);

  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
    if (!next) {
      setActiveTools([]);
      setRevealed(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setActiveState((prev) => {
      if (prev) {
        setActiveTools([]);
        setRevealed(false);
      }
      return !prev;
    });
  }, []);

  const queueMark = useCallback(
    (mark: Omit<PendingMarkUpMark, "id"> & { id?: string }) => {
      setPending((prev) => [
        ...prev,
        {
          ...mark,
          id: mark.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      ]);
    },
    []
  );

  const removeMarksInRange = useCallback(
    (blockKey: string, start: number, end: number) => {
      let removed: PendingMarkUpMark[] = [];
      setPending((prev) => {
        removed = prev.filter(
          (m) => m.blockKey === blockKey && m.start < end && m.end > start
        );
        const removeIds = new Set(removed.map((m) => m.id));
        return prev.filter((m) => !removeIds.has(m.id));
      });
      return removed;
    },
    []
  );

  const clearPending = useCallback(() => {
    let removed: PendingMarkUpMark[] = [];
    setPending((prev) => {
      removed = prev;
      return [];
    });
    return removed;
  }, []);

  const replacePending = useCallback((marks: PendingMarkUpMark[]) => {
    setPending(marks);
  }, []);

  const value = useMemo(
    () => ({
      active,
      activeTools,
      pending,
      revealed,
      toggle,
      setActive,
      setActiveTools,
      queueMark,
      removeMarksInRange,
      clearPending,
      replacePending,
      setRevealed,
    }),
    [
      active,
      activeTools,
      pending,
      revealed,
      toggle,
      setActive,
      queueMark,
      removeMarksInRange,
      clearPending,
      replacePending,
    ]
  );

  return (
    <MarkUpModeContext.Provider value={value}>
      {children}
    </MarkUpModeContext.Provider>
  );
}

export function useMarkUpMode() {
  const ctx = useContext(MarkUpModeContext);
  if (!ctx) {
    throw new Error("useMarkUpMode must be used within MarkUpModeProvider");
  }
  return ctx;
}

export function useMarkUpModeOptional() {
  return useContext(MarkUpModeContext);
}
