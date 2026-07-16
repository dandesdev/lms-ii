"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, Repeat2, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClassBadge, KindIcon, STATUS_LABEL, KIND_LABEL } from "@/components/dashboard/class-badge";
import { cn } from "@/lib/utils";
import { PARTIAL_LABEL, historyTone } from "@/lib/class-visuals";
import type { ClassRef, StudentSummary } from "@/types/dashboard";

type SummaryView = "grouped" | "chronological";

function EntryRow({ cls, onClick }: { cls: ClassRef; onClick?: () => void }) {
  const tone = historyTone(cls);
  return (
    <div className="space-y-1">
      <ClassBadge
        tone={tone}
        as={onClick ? "button" : "span"}
        onClick={onClick}
        title={`${cls.dateLabel} ${cls.timeLabel} — ${STATUS_LABEL[cls.status]} (${KIND_LABEL[cls.kind]})\n${cls.title}`}
        leading={
          cls.status === "present" ? (
            <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
          ) : cls.status === "absent" ? (
            <X className="h-3 w-3 shrink-0" strokeWidth={3} />
          ) : null
        }
        trailing={
          <>
            {cls.partialContinuation && (
              <CircleDashed className="h-3 w-3 shrink-0 opacity-80" aria-label={PARTIAL_LABEL} />
            )}
            {cls.kind !== "regular" && <KindIcon kind={cls.kind} />}
          </>
        }
      >
        <span className="font-semibold">
          {cls.weekday} {cls.dateLabel}
        </span>
        <span className="opacity-70">{cls.timeLabel}</span>
      </ClassBadge>
      {cls.description && (
        <p className="pl-0.5 text-[13px] leading-snug text-foreground/90">{cls.description}</p>
      )}
    </div>
  );
}

function Section({
  icon,
  label,
  entries,
  accent,
  onSelectClass,
}: {
  icon: React.ReactNode;
  label: string;
  entries: ClassRef[];
  accent?: string;
  onSelectClass?: (cls: ClassRef) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
          accent ?? "text-muted-foreground",
        )}
      >
        {icon}
        {label} ({entries.length})
      </p>
      <div className="space-y-1.5">
        {entries.map((cls, i) => (
          <EntryRow
            key={`${cls.date}-${cls.time}-${i}`}
            cls={cls}
            onClick={onSelectClass ? () => onSelectClass(cls) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: SummaryView;
  onChange: (v: SummaryView) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5 font-mono text-[11px]">
      <button
        type="button"
        onClick={() => onChange("grouped")}
        className={cn(
          "rounded-sm px-2.5 py-1 uppercase tracking-wider transition-colors",
          view === "grouped"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        By type
      </button>
      <button
        type="button"
        onClick={() => onChange("chronological")}
        className={cn(
          "rounded-sm px-2.5 py-1 uppercase tracking-wider transition-colors",
          view === "chronological"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Chronological
      </button>
    </div>
  );
}

export function ClassSummaryDialog({
  student,
  onClose,
  onSelectClass,
}: {
  student: StudentSummary | null;
  onClose: () => void;
  onSelectClass?: (cls: ClassRef) => void;
}) {
  const [view, setView] = useState<SummaryView>("grouped");
  const history = student?.history ?? [];

  useEffect(() => {
    if (student) setView("grouped");
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const attended = history.filter((h) => h.kind !== "experimental" && h.status === "present");
  const absent = history.filter((h) => h.kind !== "experimental" && h.status === "absent");
  const makeups = history.filter((h) => h.kind === "makeup");
  const trials = history.filter((h) => h.kind === "experimental");
  const chronological = [...history].reverse();

  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {student && (
          <>
            <DialogHeader>
              <DialogTitle>{student.name} — class summary</DialogTitle>
              <DialogDescription className="font-mono">
                {student.totalClasses} counted · {student.presentCount} attended ·{" "}
                {student.absentCount} absences · {student.trialCount} trial
              </DialogDescription>
            </DialogHeader>

            {student.trialWarning && (
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-foreground" title="Unusual trial class entries">
                  *
                </span>{" "}
                {student.trialCount > 1 ? (
                  <>
                    {student.trialCount} trial classes in the journal — normally there should be
                    at most one, and it should be the first.
                  </>
                ) : (
                  <>
                    Trial class is not the first entry in the journal — normally the trial comes
                    first.
                  </>
                )}
              </p>
            )}

            <ViewToggle view={view} onChange={setView} />

            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {view === "chronological" ? (
                chronological.length > 0 ? (
                  <div className="space-y-1.5">
                    {chronological.map((cls, i) => (
                      <EntryRow
                        key={`${cls.date}-${cls.time}-${i}`}
                        cls={cls}
                        onClick={onSelectClass ? () => onSelectClass(cls) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No journal entries found for this student.
                  </p>
                )
              ) : (
                <>
                  <Section
                    icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    label="Classes attended"
                    entries={attended}
                    accent="text-[#1e4d3a]"
                    onSelectClass={onSelectClass}
                  />
                  <Section
                    icon={<X className="h-3.5 w-3.5" strokeWidth={3} />}
                    label="Absences"
                    entries={absent}
                    accent="text-[#6b7468]"
                    onSelectClass={onSelectClass}
                  />
                  <Section
                    icon={<Repeat2 className="h-3.5 w-3.5" />}
                    label="Make-up classes"
                    entries={makeups}
                    accent="text-[#8a5a10]"
                    onSelectClass={onSelectClass}
                  />
                  <Section
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Trial classes (not counted)"
                    entries={trials}
                    accent="text-[#5b3d84]"
                    onSelectClass={onSelectClass}
                  />
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No journal entries found for this student.
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
