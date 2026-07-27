"use client";

import { cn } from "@/lib/utils";

/** Ruled-paper texture, same visual language as the app background. */
export const PAPER_TEXTURE = {
  backgroundImage: [
    "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(30, 77, 58, 0.08), transparent)",
    "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(120, 100, 60, 0.05) 31px, rgba(120, 100, 60, 0.05) 32px)",
  ].join(","),
};

/** Faint diagonal weave over the filled portion of the bar. */
export const INK_TEXTURE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 5px, transparent 5px 10px)",
};

/**
 * Full-bleed paper loading screen: big playful headline, a single muted status
 * line, and an ink progress bar. No card chrome — the wait is the composition.
 */
export function PaperLoadingSheet({
  title,
  status,
  progress,
  leaving = false,
  fullscreen = true,
  className,
}: {
  /** Large centered headline (Architects Daughter / playful). */
  title: string;
  /** Small gray line describing the current wait. */
  status: string;
  progress: number;
  leaving?: boolean;
  /** Full-viewport overlay (boot) vs in-flow page shell (loading.tsx). */
  fullscreen?: boolean;
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={cn(
        "flex items-center justify-center px-8",
        fullscreen ? "fixed inset-0 z-100" : "min-h-screen w-full",
        "transition-opacity duration-300 ease-out motion-reduce:transition-none",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={!leaving}
    >
      <div
        className={cn(
          "absolute inset-0 bg-background",
          !fullscreen && "min-h-screen"
        )}
        style={PAPER_TEXTURE}
      />

      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <h1 className="font-playful text-[2.75rem] leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">{status}</p>
        <div className="mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full border border-editor-chrome bg-[#f0e7d2]">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${width}%`, ...INK_TEXTURE }}
          />
        </div>
      </div>
    </div>
  );
}
