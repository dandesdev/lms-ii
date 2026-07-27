"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { scanWorkspace } from "@/lib/workspace/scan-browser";
import {
  clearWorkspaceHandle,
  loadWorkspaceHandle,
  saveWorkspaceHandle,
  verifyHandlePermission,
} from "@/lib/workspace/handle-store";

type SyncPhase = "idle" | "reading" | "uploading" | "done" | "error";

export type WorkspaceConnectHandle = {
  sync: () => Promise<void>;
  pickFolder: () => Promise<void>;
  disconnect: () => Promise<void>;
  folderName: string | null;
  busy: boolean;
  message: string;
};

/**
 * Headless workspace controller — keeps the folder handle + observer alive
 * for the whole dashboard session. UI lives in header buttons / settings.
 */
export const WorkspaceController = forwardRef<
  WorkspaceConnectHandle,
  {
    onSynced?: (syncedAt: string) => void;
    onFolderChange?: (folderName: string | null) => void;
    onStatus?: (status: { busy: boolean; message: string; phase: SyncPhase }) => void;
  }
>(function WorkspaceController({ onSynced, onFolderChange, onStatus }, ref) {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [message, setMessage] = useState("");
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const observerRef = useRef<FileSystemObserver | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<SyncPhase>("idle");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const publishStatus = useCallback(
    (nextPhase: SyncPhase, nextMessage: string) => {
      setPhase(nextPhase);
      setMessage(nextMessage);
      onStatus?.({
        busy: nextPhase === "reading" || nextPhase === "uploading",
        message: nextMessage,
        phase: nextPhase,
      });
    },
    [onStatus]
  );

  const setFolder = useCallback(
    (name: string | null) => {
      setFolderName(name);
      onFolderChange?.(name);
    },
    [onFolderChange]
  );

  const runSync = useCallback(
    async (handle: FileSystemDirectoryHandle, source: "manual" | "auto" = "manual") => {
      if (phaseRef.current === "reading" || phaseRef.current === "uploading") return;
      publishStatus("reading", source === "auto" ? "Auto-syncing…" : "Reading local files…");

      try {
        const scan = await scanWorkspace(handle);
        if (scan.errors.length > 0 && !scan.journalContent && scan.students.length === 0) {
          throw new Error(scan.errors[0]);
        }

        // Light preflight: only block when already at capacity (don't treat
        // already-synced markdown as "additional" bytes every sync).
        const preflight = await fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalBytes: 0 }),
        });
        const pre = await preflight.json();
        if (!preflight.ok && pre.code === "STORAGE_FULL") {
          throw new Error(pre.error || "Storage full");
        }

        publishStatus("uploading", "Uploading to the cloud…");

        const res = await fetch("/api/workspace/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journalContent: scan.journalContent,
            students: scan.students,
            classFiles: scan.classFiles.map(({ folderId, file }) => ({
              folderId,
              filename: file.filename,
              markdown: file.markdown,
              status: file.status,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync failed");

        const parts = [
          `Synced — ${data.imported ?? 0} new, ${data.updated ?? 0} updated`,
        ];
        if (data.skippedQuota) {
          parts.push(`${data.skippedQuota} skipped (storage full)`);
        }
        if (scan.errors.length > 0) {
          parts.push(`${scan.errors.length} warning(s)`);
        }
        publishStatus("done", parts.join(". ") + ".");
        onSynced?.(data.syncedAt);
      } catch (err) {
        publishStatus("error", err instanceof Error ? err.message : "Sync failed");
      } finally {
        setTimeout(() => publishStatus("idle", ""), 4000);
      }
    },
    [onSynced, publishStatus]
  );

  const startObserver = useCallback(
    (handle: FileSystemDirectoryHandle) => {
      if (typeof FileSystemObserver === "undefined") return;
      observerRef.current?.disconnect();
      const observer = new FileSystemObserver(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          void runSync(handle, "auto");
        }, 3000);
      });
      observer.observe(handle, { recursive: true }).catch(() => {});
      observerRef.current = observer;
    },
    [runSync]
  );

  const connectHandle = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      const ok = await verifyHandlePermission(handle, "read");
      if (!ok) throw new Error("Folder permission denied");
      handleRef.current = handle;
      setFolder(handle.name);
      await saveWorkspaceHandle(handle);
      startObserver(handle);
      await runSync(handle, "manual");
    },
    [runSync, setFolder, startObserver]
  );

  const pickFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      publishStatus(
        "error",
        "This browser cannot pick folders — use Chrome or Edge on desktop."
      );
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      await connectHandle(handle);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      publishStatus(
        "error",
        err instanceof Error ? err.message : "Could not open folder"
      );
    }
  }, [connectHandle, publishStatus]);

  const syncNow = useCallback(async () => {
    if (!handleRef.current) {
      await pickFolder();
      return;
    }
    await runSync(handleRef.current, "manual");
  }, [pickFolder, runSync]);

  const disconnect = useCallback(async () => {
    observerRef.current?.disconnect();
    handleRef.current = null;
    setFolder(null);
    await clearWorkspaceHandle();
    publishStatus("idle", "Workspace disconnected.");
  }, [publishStatus, setFolder]);

  useImperativeHandle(
    ref,
    () => ({
      sync: syncNow,
      pickFolder,
      disconnect,
      folderName,
      busy: phase === "reading" || phase === "uploading",
      message,
    }),
    [syncNow, pickFolder, disconnect, folderName, phase, message]
  );

  useEffect(() => {
    void (async () => {
      const saved = await loadWorkspaceHandle();
      if (!saved) return;
      const ok = await verifyHandlePermission(saved, "read");
      if (!ok) return;
      handleRef.current = saved;
      setFolder(saved.name);
      startObserver(saved);
    })();
    return () => {
      observerRef.current?.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [setFolder, startObserver]);

  return null;
});
