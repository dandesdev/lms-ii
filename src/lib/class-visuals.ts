import type { ClassRef } from "@/types/dashboard";

/** Semantic tones — ready = green, danger = red, partial = yellow, absent = muted gray-green. */
export type ClassTone = "ready" | "danger" | "partial" | "absent" | "neutral";

export const PARTIAL_LABEL = "Partial";

export const CLASS_CHIP: Record<ClassTone, string> = {
  ready: "border-[#1e4d3a]/25 bg-[#e6f0e8] text-[#1e4d3a] hover:bg-[#d5e6d9]",
  danger: "border-[#a3341f]/35 bg-[#f7e4de] text-[#a3341f] hover:bg-[#f2d5cc]",
  partial: "border-[#b8860b]/35 bg-[#f7ebc8] text-[#6b5624] hover:bg-[#f0dfaa]",
  absent: "border-[#8a9a8e]/30 bg-[#d8dad8] text-[#6b7468] hover:bg-[#d8e0da]",
  neutral: "border-[#77694f]/30 bg-[#ece4d3] text-[#6b5d43] hover:bg-[#e3d8c2]",
};

/** Subtle row highlight when an upcoming class has no file ready. */
export const ROW_UPCOMING_DANGER = "bg-[#f7e4de]/30";

export function historyTone(cls: ClassRef): ClassTone {
  if (cls.partialContinuation) return "partial";
  if (cls.status === "present") return "ready";
  if (cls.status === "absent") return "absent";
  return "neutral";
}

export function readyCountTone(
  readyCount: number,
  partialCount: number,
  upcomingNoFile: boolean,
): ClassTone {
  if (upcomingNoFile) return "danger";
  if (readyCount === 0) return "danger";
  // Yellow only when the sole ready class is partial; multiple ready → green
  // (partial icon still shown by ReadyCountBadge).
  if (partialCount > 0 && readyCount === 1) return "partial";
  return "ready";
}

export function upcomingTone(
  warning: "no-file" | "unknown-student" | null,
  hasPartial: boolean,
): ClassTone {
  if (warning) return "danger";
  if (hasPartial) return "partial";
  return "ready";
}
