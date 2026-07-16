"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  Check,
  CircleDashed,
  CircleSlash,
  Repeat2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLASS_CHIP,
  PARTIAL_LABEL,
  historyTone,
  readyCountTone,
  type ClassTone,
} from "@/lib/class-visuals";
import type { ClassRef } from "@/types/dashboard";

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] leading-tight transition-colors";

function StatusIcon({ status }: { status: ClassRef["status"] }) {
  switch (status) {
    case "present":
      return <Check className="h-3 w-3 shrink-0" strokeWidth={3} />;
    case "absent":
      return <X className="h-3 w-3 shrink-0" strokeWidth={3} />;
    default:
      return <CircleSlash className="h-3 w-3 shrink-0" />;
  }
}

export function KindIcon({ kind, className }: { kind: ClassRef["kind"]; className?: string }) {
  switch (kind) {
    case "makeup":
      return <Repeat2 className={cn("h-3 w-3 shrink-0", className)} />;
    case "rescheduled":
      return <CalendarClock className={cn("h-3 w-3 shrink-0", className)} />;
    case "experimental":
      return <Sparkles className={cn("h-3 w-3 shrink-0", className)} />;
    default:
      return null;
  }
}

export const KIND_LABEL: Record<ClassRef["kind"], string> = {
  regular: "Regular",
  makeup: "Make-up",
  rescheduled: "Rescheduled",
  experimental: "Trial class",
};

export const STATUS_LABEL: Record<ClassRef["status"], string> = {
  present: "Present",
  absent: "Absent",
  cancelled: "Cancelled",
  "no-class": "No class",
};

export function ClassBadge({
  tone,
  title,
  className,
  leading,
  trailing,
  children,
  as = "span",
  onClick,
}: {
  tone: ClassTone;
  title?: string;
  className?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  as?: "span" | "button";
  onClick?: () => void;
}) {
  const Tag = as;
  return (
    <Tag
      type={as === "button" ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        CHIP_BASE,
        CLASS_CHIP[tone],
        as === "button" && "cursor-pointer",
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </Tag>
  );
}

/** Journal history chip — check/X, date, time, optional kind & partial markers. */
export function HistoryClassBadge({ cls, onClick }: { cls: ClassRef; onClick: () => void }) {
  const [dd, mm] = cls.dateLabel.split("/");
  const partialNote = cls.partialContinuation
    ? "\nPartial — unfinished class file still in classes/ (continue next time)."
    : "";
  return (
    <ClassBadge
      tone={historyTone(cls)}
      as="button"
      onClick={onClick}
      title={`${cls.dateLabel} ${cls.timeLabel} — ${STATUS_LABEL[cls.status]} (${KIND_LABEL[cls.kind]})${partialNote}\n${cls.title}`}
      leading={<StatusIcon status={cls.status} />}
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
        {dd}/{mm}
      </span>
      <span className="opacity-70">{cls.timeLabel}</span>
    </ClassBadge>
  );
}

/** Upcoming class from Google Agenda — danger / partial / ready. */
export function UpcomingClassBadge({
  when,
  studentName,
  tone,
  title,
}: {
  when: string;
  studentName: string | null;
  tone: ClassTone;
  title: string;
}) {
  return (
    <ClassBadge
      tone={tone}
      title={title}
      leading={
        tone === "danger" ? (
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <CalendarCheck2 className="h-3 w-3 shrink-0" />
        )
      }
      trailing={
        tone === "partial" ? (
          <CircleDashed className="h-3 w-3 shrink-0 opacity-80" aria-label={PARTIAL_LABEL} />
        ) : undefined
      }
    >
      <span className="font-semibold">{when}</span>
      {studentName}
    </ClassBadge>
  );
}

/** Ready-column count for the student table. */
export function ReadyCountBadge({
  readyCount,
  partialCount,
  freshCount,
  upcomingNoFile,
}: {
  readyCount: number;
  partialCount: number;
  freshCount: number;
  upcomingNoFile: boolean;
}) {
  const tone = readyCountTone(readyCount, partialCount, upcomingNoFile);
  const title = upcomingNoFile
    ? "Upcoming class scheduled — no class file ready in classes/"
    : readyCount === 0
      ? "No classes prepared"
      : partialCount > 0 && freshCount > 0
        ? `${freshCount} fresh, ${partialCount} partial to continue`
        : partialCount > 0
          ? `${partialCount} partial to continue`
          : `${freshCount} fresh`;

  if (readyCount === 0) {
    return (
      <ClassBadge tone={tone} title={title} leading={upcomingNoFile ? <AlertTriangle className="h-3 w-3" /> : undefined}>
        none!
      </ClassBadge>
    );
  }

  return (
    <ClassBadge
      tone={tone}
      title={title}
      leading={upcomingNoFile ? <AlertTriangle className="h-3 w-3" /> : undefined}
      trailing={
        partialCount > 0 ? (
          <CircleDashed className="h-3 w-3 shrink-0 opacity-80" aria-label={PARTIAL_LABEL} />
        ) : undefined
      }
    >
      <span className="font-semibold">{readyCount}</span>
    </ClassBadge>
  );
}
