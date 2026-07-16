"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LedgerBadge } from "@/components/dashboard/ledger-badge";
import { KIND_LABEL, STATUS_LABEL } from "@/components/dashboard/class-badge";
import type { ClassRef } from "@/types/dashboard";

export interface SelectedClass {
  studentId: string;
  studentName: string;
  cls: ClassRef;
}

const STATUS_VARIANT: Record<ClassRef["status"], "present" | "absent" | "cancelled" | "noclass"> = {
  present: "present",
  absent: "absent",
  cancelled: "cancelled",
  "no-class": "noclass",
};

const KIND_VARIANT: Record<ClassRef["kind"], "secondary" | "makeup" | "rescheduled" | "experimental"> = {
  regular: "secondary",
  makeup: "makeup",
  rescheduled: "rescheduled",
  experimental: "experimental",
};

export function ClassDetailDialog({
  selected,
  onClose,
}: {
  selected: SelectedClass | null;
  onClose: () => void;
}) {
  const cls = selected?.cls;

  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {cls && selected && (
          <>
            <DialogHeader>
              <DialogTitle>{selected.studentName}</DialogTitle>
              <DialogDescription className="font-mono">
                {cls.weekday} · {cls.dateLabel} · {cls.timeLabel}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <LedgerBadge variant={STATUS_VARIANT[cls.status]}>{STATUS_LABEL[cls.status]}</LedgerBadge>
              <LedgerBadge variant={KIND_VARIANT[cls.kind]}>{KIND_LABEL[cls.kind]}</LedgerBadge>
              {cls.partialContinuation && <LedgerBadge variant="partial">Partial</LedgerBadge>}
            </div>

            <div className="rounded-md border bg-background/60 p-4">
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Journal entry — what was worked on &amp; observations
              </p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {cls.description}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
