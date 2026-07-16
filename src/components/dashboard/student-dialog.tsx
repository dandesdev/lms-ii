"use client";

import { BookOpenCheck, CircleDashed, FileText, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HistoryClassBadge, ClassBadge } from "@/components/dashboard/class-badge";
import { CLASS_CHIP } from "@/lib/class-visuals";
import { cn } from "@/lib/utils";
import type { ClassRef, StudentSummary } from "@/types/dashboard";

export function StudentDialog({
  student,
  onClose,
  onSelectClass,
}: {
  student: StudentSummary | null;
  onClose: () => void;
  onSelectClass: (cls: ClassRef) => void;
}) {
  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {student && (
          <>
            <DialogHeader>
              <DialogTitle>{student.name}</DialogTitle>
              <DialogDescription className="font-mono">
                {student.level ?? "Level not set"}
                {student.startDate ? ` · since ${student.startDate}` : ""}
              </DialogDescription>
            </DialogHeader>

            {student.goals && student.goals.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border bg-background/60 p-3 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {student.goals.length === 1 ? (
                  <span>{student.goals[0]}</span>
                ) : (
                  <ul className="list-disc space-y-1 pl-4">
                    {student.goals.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border bg-background/60 p-3">
                <p className="font-display text-2xl font-semibold">{student.totalClasses}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Classes total
                </p>
              </div>
              <div className={cn("rounded-md border p-3", CLASS_CHIP.ready)}>
                <p className="font-display text-2xl font-semibold">{student.presentCount}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider opacity-70">Present</p>
              </div>
              <div className={cn("rounded-md border p-3", CLASS_CHIP.absent)}>
                <p className="font-display text-2xl font-semibold">{student.absentCount}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider opacity-70">Absent</p>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <BookOpenCheck className="h-3.5 w-3.5" />
                Classes ready to be given ({student.readyClasses.length})
              </p>
              {student.readyClasses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {student.readyClasses.map((c) => (
                    <ClassBadge
                      key={c.fileName}
                      tone={c.state === "started" ? "partial" : "ready"}
                      title={
                        c.state === "started"
                          ? `Partial class from ${c.date}; still in classes/`
                          : "Fresh class; not started yet"
                      }
                      leading={<FileText className="h-3 w-3" />}
                      trailing={
                        c.state === "started" ? (
                          <CircleDashed className="h-3 w-3 shrink-0 opacity-80" aria-label="Partial" />
                        ) : undefined
                      }
                    >
                      <span className="normal-case tracking-normal">{c.title}</span>
                    </ClassBadge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No prepared classes in the queue — time to plan the next one.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Full class history — click one for details
              </p>
              <div className="flex max-h-56 flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
                {student.history.map((cls, i) => (
                  <HistoryClassBadge
                    key={`${cls.date}-${cls.time}-${i}`}
                    cls={cls}
                    onClick={() => onSelectClass(cls)}
                  />
                ))}
                {student.history.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No journal entries found for this student yet.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
