import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type WaitingKind =
  | "class-opening"
  | "editor"
  | "fonts"
  | "dashboard"
  | "classes"
  | "generic";

export type WaitingVariant = "page" | "inline";

const DEFAULT_LABELS: Record<WaitingKind, string> = {
  "class-opening": "Opening class…",
  editor: "Loading editor…",
  fonts: "Loading fonts…",
  dashboard: "Loading dashboard…",
  classes: "Loading classes…",
  generic: "Loading…",
};

export function Waiting({
  kind = "generic",
  label,
  variant = "inline",
  className,
}: {
  kind?: WaitingKind;
  /** Overrides the default copy for `kind`. */
  label?: string;
  variant?: WaitingVariant;
  className?: string;
}) {
  const text = label ?? DEFAULT_LABELS[kind];
  const spinner = (
    <Loader2
      className={cn(
        "shrink-0 animate-spin",
        variant === "page" ? "h-5 w-5" : "h-4 w-4"
      )}
    />
  );

  if (variant === "page") {
    return (
      <main
        className={cn(
          "flex min-h-screen items-center justify-center gap-2 bg-[#fffdf8] text-muted-foreground",
          className
        )}
      >
        {spinner}
        {text}
      </main>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        className
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {spinner}
      <span>{text}</span>
    </div>
  );
}
