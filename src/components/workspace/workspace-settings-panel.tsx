"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { FolderOpen, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceConnectHandle } from "@/components/workspace/workspace-connect";

/** Presentational workspace controls that drive the shared WorkspaceController. */
export function WorkspaceSettingsPanel({
  folderName,
  busy,
  message,
  controllerRef,
}: {
  folderName: string | null;
  busy: boolean;
  message: string;
  controllerRef: RefObject<WorkspaceConnectHandle | null>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void controllerRef.current?.pickFolder()}
          disabled={busy}
        >
          <FolderOpen className="h-4 w-4" />
          {folderName ? "Change folder" : "Connect workspace"}
        </Button>
        {folderName && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void controllerRef.current?.sync()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync now
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void controllerRef.current?.disconnect()}
            >
              <Unplug className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      {folderName ? (
        <p className="font-mono text-xs text-muted-foreground">
          Connected: <span className="text-foreground">{folderName}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Choose the root folder that contains <span className="font-mono">control/</span> and{" "}
          <span className="font-mono">students/</span>.
        </p>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <p className="text-xs text-muted-foreground">
        Need the folder layout?{" "}
        <Link
          href="/docs/getting-started"
          className="text-primary underline-offset-2 hover:underline"
        >
          Getting started guide
        </Link>
      </p>
    </div>
  );
}
