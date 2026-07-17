"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { ToolbarPopover } from "./toolbar-ui";

/** Google-Docs-style palette. */
const PALETTE: string[][] = [
  ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"],
  ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"],
  ["#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
  ["#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0"],
  ["#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"],
];

const RECENT_KEY = "lms-recent-colors";
const MAX_RECENT = 10;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Persist a custom-picked color (shared across all pickers, like Google Docs). */
export function rememberRecentColor(color: string) {
  if (typeof window === "undefined") return;
  const next = [color, ...loadRecent().filter((c) => c !== color)].slice(
    0,
    MAX_RECENT
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — recents just won't persist */
  }
}

function Swatch({
  color,
  onPick,
  size = "h-5 w-5",
}: {
  color: string;
  onPick: (color: string) => void;
  size?: string;
}) {
  return (
    <button
      type="button"
      title={color}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(color)}
      className={cn(
        size,
        "rounded-sm border border-black/15 transition-transform hover:scale-110 hover:border-black/40"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function ColorPalette({
  onPick,
  onClear,
  clearLabel = "None",
}: {
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel?: string;
}) {
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [custom, setCustom] = useState("#1e4d3a");

  const pick = useCallback(
    (color: string, remember = false) => {
      if (remember) {
        rememberRecentColor(color);
        setRecent(loadRecent());
      }
      onPick(color);
    },
    [onPick]
  );

  return (
    <div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClear}
        className="mb-2 w-full rounded-md border px-2 py-1 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent"
      >
        {clearLabel}
      </button>

      <div className="space-y-1">
        {PALETTE.map((row, i) => (
          <div key={i} className="flex gap-1">
            {row.map((color) => (
              <Swatch key={color} color={color} onPick={(c) => pick(c)} />
            ))}
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          <div className="flex flex-wrap gap-1">
            {recent.map((color) => (
              <Swatch key={color} color={color} onPick={(c) => pick(c)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 border-t pt-2">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Custom
        </p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
            title="Pick a custom color"
          />
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pick(custom, true);
            }}
            className="w-20 rounded border bg-white px-1.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(custom, true)}
            className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact split control with a corner dropdown affordance.
 *
 * Hover rules (least confusing):
 * - Hovering the corner arrow highlights the whole control (main + arrow).
 * - Hovering only the main toggle does not highlight the arrow.
 */
export function CornerSplitButton({
  title,
  dropdownTitle,
  active,
  dropdownOpen,
  onMainClick,
  onDropdownClick,
  children,
  footer,
  className,
}: {
  title: string;
  dropdownTitle?: string;
  /** Persistent state of the tool itself (e.g. locked) — styles the main button. */
  active?: boolean;
  /** Whether the dropdown is open — styles the corner arrow only. */
  dropdownOpen?: boolean;
  onMainClick: () => void;
  onDropdownClick: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative inline-flex">
      {/* Arrow is the peer so main can react to arrow-hover; main cannot light the arrow. */}
      <button
        type="button"
        title={dropdownTitle ?? `${title} options`}
        aria-label={dropdownTitle ?? `${title} options`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDropdownClick}
        className={cn(
          "peer/arrow absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-editor-chrome bg-white text-editor-ink transition-colors hover:bg-accent",
          dropdownOpen && "bg-accent"
        )}
      >
        <ChevronDownIcon className="h-2.5 w-2.5" />
      </button>
      <button
        type="button"
        title={title}
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onMainClick}
        className={cn(
          "editor-toolbar-btn relative overflow-visible hover:bg-accent peer-hover/arrow:bg-accent",
          active && "editor-toolbar-btn-active",
          className
        )}
      >
        {children}
        {footer}
      </button>
    </div>
  );
}

/**
 * Split control: click the main button to apply `defaultColor` immediately,
 * or the small chevron to open the palette. Picking a palette color applies it
 * and promotes it to the new default (mirrors the alignment tool's affordance).
 */
export function SplitColorButton({
  name,
  icon,
  defaultColor,
  onApply,
  onClear,
  onDefaultChange,
  clearLabel = "None",
}: {
  name: string;
  icon?: ReactNode;
  defaultColor: string;
  onApply: (color: string) => void;
  onClear: () => void;
  onDefaultChange: (color: string) => void;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <CornerSplitButton
        title={name}
        dropdownTitle={`${name} — choose color`}
        dropdownOpen={open}
        onMainClick={() => onApply(defaultColor)}
        onDropdownClick={() => setOpen((o) => !o)}
        className="flex-col gap-0.5"
        footer={
          <span
            className="h-1 w-4 rounded-full border border-black/10"
            style={{ backgroundColor: defaultColor || "transparent" }}
          />
        }
      >
        {icon}
      </CornerSplitButton>

      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        className="w-[228px] p-3"
      >
        <ColorPalette
          onPick={(color) => {
            onDefaultChange(color);
            onApply(color);
            setOpen(false);
          }}
          onClear={() => {
            onClear();
            setOpen(false);
          }}
          clearLabel={clearLabel}
        />
      </ToolbarPopover>
    </div>
  );
}

function ChevronDownIcon({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ColorPickerPopover({
  name,
  icon,
  active,
  onPick,
  onClear,
  clearLabel = "None",
  embedded = false,
}: {
  name: string;
  icon?: ReactNode;
  /** Current color shown as an underline strip on the trigger. */
  active?: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel?: string;
  /** Render palette only (no trigger) — for nesting inside other popovers. */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (embedded) {
    return (
      <ColorPalette
        onPick={onPick}
        onClear={onClear}
        clearLabel={clearLabel}
      />
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={name}
        aria-label={name}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "editor-toolbar-btn flex-col gap-0.5",
          open && "editor-toolbar-btn-active"
        )}
      >
        {icon}
        <span
          className="h-1 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: active || "transparent" }}
        />
      </button>

      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        className="w-[228px] p-3"
      >
        <ColorPalette
          onPick={(color) => {
            onPick(color);
            setOpen(false);
          }}
          onClear={() => {
            onClear();
            setOpen(false);
          }}
          clearLabel={clearLabel}
        />
      </ToolbarPopover>
    </div>
  );
}
