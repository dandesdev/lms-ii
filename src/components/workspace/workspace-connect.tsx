"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanWorkspace, estimateScanBytes } from "@/lib/workspace/scan-browser";
import {
  clearWorkspaceHandle,
  loadWorkspaceHandle,
  saveWorkspaceHandle,
  verifyHandlePermission,
} from "@/lib/workspace/handle-store";
import { cn } from "@/lib/utils";

type SyncPhase = "idle" | "reading" | "uploading" | "done" | "error";

export function WorkspaceConnect({
  onSynced,
}: {
  onSynced?: (syncedAt: string) => void;
}) {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [message, setMessage] = useState("");
  const [observerSupported, setObserverSupported] = useState(false);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const observerRef = useRef<FileSystemObserver | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(
    async (handle: FileSystemDirectoryHandle, source: "manual" | "auto" = "manual") => {
      if (phase === "reading" || phase === "uploading") return;
      setPhase("reading");
      setMessage(source === "auto" ? "Auto-syncing…" : "Reading local files…");

      try {
        const scan = await scanWorkspace(handle);
        if (scan.errors.length > 0 && !scan.journalContent && scan.students.length === 0) {
          throw new Error(scan.errors[0]);
        }

        const additionalBytes = estimateScanBytes(scan);
        const preflight = await fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalBytes }),
        });
        const pre = await preflight.json();
        if (!preflight.ok && pre.code === "STORAGE_FULL") {
          throw new Error(pre.error || "Storage full");
        }

        setPhase("uploading");
        setMessage("Uploading to the cloud…");

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

        setPhase("done");
        const warn =
          scan.errors.length > 0
            ? `Synced with ${scan.errors.length} warning(s).`
            : `Synced — ${data.imported} new, ${data.updated} updated.`;
        setMessage(warn);
        onSynced?.(data.syncedAt);
      } catch (err) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Sync failed");
      } finally {
        setTimeout(() => setPhase("idle"), 4000);
      }
    },
    [onSynced, phase]
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
      setFolderName(handle.name);
      await saveWorkspaceHandle(handle);
      startObserver(handle);
      await runSync(handle, "manual");
    },
    [runSync, startObserver]
  );

  useEffect(() => {
    setObserverSupported(typeof FileSystemObserver !== "undefined");
    void (async () => {
      const saved = await loadWorkspaceHandle();
      if (!saved) return;
      const ok = await verifyHandlePermission(saved, "read");
      if (!ok) return;
      handleRef.current = saved;
      setFolderName(saved.name);
      startObserver(saved);
    })();
    return () => {
      observerRef.current?.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startObserver]);

  async function pickFolder() {
    if (!window.showDirectoryPicker) {
      setMessage("This browser cannot pick folders — use Chrome or Edge on desktop.");
      setPhase("error");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      await connectHandle(handle);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Could not open folder");
    }
  }

  async function disconnect() {
    observerRef.current?.disconnect();
    handleRef.current = null;
    setFolderName(null);
    await clearWorkspaceHandle();
    setMessage("Workspace disconnected.");
  }

  const busy = phase === "reading" || phase === "uploading";

  return (
    <div className="rounded-lg border bg-card/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={pickFolder} disabled={busy}>
          <FolderOpen className="h-4 w-4" />
          {folderName ? "Change folder" : "Connect workspace"}
        </Button>
        {folderName && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRef.current && runSync(handleRef.current, "manual")}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync now
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={disconnect}>
              <Unplug className="h-4 w-4" />
            </Button>
          </>
        )}
        <Link
          href="/docs/getting-started"
          className="font-mono text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Folder setup guide
        </Link>
      </div>
      {folderName && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Connected: <span className="text-foreground">{folderName}</span>
          {!observerSupported && (
            <span className="ml-2 text-[#8a5a10]">
              Auto-sync unavailable — use Sync now after local edits.
            </span>
          )}
        </p>
      )}
      {message && (
        <p
          className={cn(
            "mt-2 text-sm",
            phase === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
