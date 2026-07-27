"use client";

import type { ReactNode } from "react";
import { useMarkUpMode } from "./mark-up-mode-context";
import { useEditorColors } from "./editor-colors-context";

/** Soft vignette while mark-up mode is active. Kept separate so the heavy
 *  mark-up-mode chunk can load without wrapping/unmounting the editor. */
export function MarkUpModeChrome({ children }: { children: ReactNode }) {
  const { active } = useMarkUpMode();
  const { vignetteColor } = useEditorColors();
  const softVignette = vignetteColor
    .replace("rgb(", "rgba(")
    .replace(")", ", 0.5)");
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            boxShadow: `inset 0 0 0 6px ${vignetteColor}, inset 0 0 90px 16px ${softVignette}`,
          }}
        />
      )}
      {children}
    </div>
  );
}
