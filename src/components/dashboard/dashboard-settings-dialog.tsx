"use client";

import type { RefObject } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceSettingsPanel } from "@/components/workspace/workspace-settings-panel";
import type { WorkspaceConnectHandle } from "@/components/workspace/workspace-connect";
import { UsagePanel } from "@/components/dashboard/usage-panel";
import { AgendaConnectForm } from "@/components/dashboard/agenda-connect-form";
import type { AgendaPayload } from "@/types/dashboard";

export function DashboardSettingsDialog({
  open,
  onOpenChange,
  folderName,
  busy,
  workspaceMessage,
  controllerRef,
  onAgendaConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string | null;
  busy: boolean;
  workspaceMessage: string;
  controllerRef: RefObject<WorkspaceConnectHandle | null>;
  onAgendaConnected?: (agenda: AgendaPayload, syncedAt: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Workspace folder, cloud space, and Google Agenda.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Workspace
          </h3>
          <WorkspaceSettingsPanel
            folderName={folderName}
            busy={busy}
            message={workspaceMessage}
            controllerRef={controllerRef}
          />
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Storage
          </h3>
          <UsagePanel />
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Calendar
          </h3>
          <AgendaConnectForm onConnected={onAgendaConnected} />
        </section>
      </DialogContent>
    </Dialog>
  );
}
