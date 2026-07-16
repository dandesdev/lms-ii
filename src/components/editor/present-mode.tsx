"use client";

import { useState } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

/** Zoom and fullscreen actions rendered inside the editor toolbar. */
export function ToolbarZoomControls({
  zoom,
  onZoomChange,
  isFullscreen,
  onToggleFullscreen,
  compact = false,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  compact?: boolean;
}) {
  const btn =
    "editor-toolbar-btn";
  if (compact) {
    // Each control is a direct child so the vertical toolbar grid can place
    // them in its two-column flow (no nested flex column wrapper).
    return (
      <>
        <button
          type="button"
          title="Zoom out"
          className={btn}
          disabled={zoom <= 75}
          onClick={() => onZoomChange(Math.max(75, zoom - 10))}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={`Zoom in (${zoom}%)`}
          className={btn}
          disabled={zoom >= 200}
          onClick={() => onZoomChange(Math.min(200, zoom + 10))}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={isFullscreen ? "Exit fullscreen" : "Present fullscreen"}
          className={btn}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        title="Zoom out"
        className={btn}
        disabled={zoom <= 75}
        onClick={() => onZoomChange(Math.max(75, zoom - 10))}
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Reset zoom"
        onClick={() => onZoomChange(100)}
        className="min-w-[3rem] rounded-md px-1 py-1.5 text-center font-mono text-xs font-medium text-editor-ink transition-colors hover:bg-accent"
      >
        {zoom}%
      </button>
      <button
        type="button"
        title="Zoom in"
        className={btn}
        disabled={zoom >= 200}
        onClick={() => onZoomChange(Math.min(200, zoom + 10))}
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        title={isFullscreen ? "Exit fullscreen" : "Present fullscreen"}
        className={btn}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function usePresentMode() {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return { zoom, setZoom, isFullscreen, toggleFullscreen };
}
