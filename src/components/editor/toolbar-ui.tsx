"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ToolbarDock = "top" | "bottom" | "left" | "right";

export type PopoverPlacement = "below" | "above" | "beside-start" | "beside-end";

type ToolbarUiContextValue = {
  vertical: boolean;
  dock: ToolbarDock;
  placement: PopoverPlacement;
};

const ToolbarUiContext = createContext<ToolbarUiContextValue>({
  vertical: false,
  dock: "right",
  placement: "below",
});

export function ToolbarUiProvider({
  dock,
  children,
}: {
  dock: ToolbarDock;
  children: React.ReactNode;
}) {
  const vertical = dock === "left" || dock === "right";
  const placement: PopoverPlacement =
    dock === "top"
      ? "below"
      : dock === "bottom"
        ? "above"
        : dock === "left"
          ? "beside-end"
          : "beside-start";

  return (
    <ToolbarUiContext.Provider value={{ vertical, dock, placement }}>
      {children}
    </ToolbarUiContext.Provider>
  );
}

export function useToolbarUi() {
  return useContext(ToolbarUiContext);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Toolbar popover panel rendered in a portal at the document body, positioned
 * fixed next to its trigger. This lets panels escape the toolbar rail without
 * being clipped by backdrop-filter or grid overflow.
 */
export function ToolbarPopover({
  open,
  onClose,
  anchorRef,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const { placement } = useToolbarUi();
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const place = () => {
      const r = anchor.getBoundingClientRect();
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      let top: number;
      let left: number;
      switch (placement) {
        case "beside-end":
          left = r.right + 8;
          top = r.top;
          break;
        case "beside-start":
          left = r.left - 8 - pw;
          top = r.top;
          break;
        case "above":
          left = r.left;
          top = r.top - 4 - ph;
          break;
        default:
          left = r.left;
          top = r.bottom + 4;
      }
      panel.style.top = `${clamp(top, 8, window.innerHeight - ph - 8)}px`;
      panel.style.left = `${clamp(left, 8, window.innerWidth - pw - 8)}px`;
      panel.style.visibility = "visible";
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className={cn("z-50 rounded-lg border bg-card shadow-xl", className)}
    >
      {children}
    </div>,
    document.body
  );
}
