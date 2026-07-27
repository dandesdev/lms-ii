"use client";

import {
  CLASS_BOOT_STEPS,
  stepLabel,
  type ClassBootMode,
} from "./steps";
import { PaperLoadingSheet } from "@/components/paper-loading-sheet";

export function ClassBootOverlay({
  mode,
  title,
  stepIndex,
  progress,
  leaving,
}: {
  mode: ClassBootMode;
  title: string;
  stepIndex: number;
  progress: number;
  leaving: boolean;
}) {
  const active =
    CLASS_BOOT_STEPS[Math.min(stepIndex, CLASS_BOOT_STEPS.length - 1)];
  const status =
    stepIndex >= CLASS_BOOT_STEPS.length
      ? "Ready"
      : stepLabel(active, mode);

  return (
    <PaperLoadingSheet
      fullscreen
      leaving={leaving}
      title={title}
      status={status}
      progress={progress}
    />
  );
}
