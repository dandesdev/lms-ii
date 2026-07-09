"use client";

import { useState } from "react";
import { Toolbar } from "@liveblocks/react-lexical";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PresentModeControls({
  zoom,
  onZoomChange,
  onToggleFullscreen,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Toolbar.Button
        name="Zoom out"
        icon={<ZoomOut className="h-4 w-4" />}
        onClick={() => onZoomChange(Math.max(75, zoom - 10))}
      />
      <span className="min-w-[3rem] text-center text-xs font-medium">{zoom}%</span>
      <Toolbar.Button
        name="Zoom in"
        icon={<ZoomIn className="h-4 w-4" />}
        onClick={() => onZoomChange(Math.min(200, zoom + 10))}
      />
      <Toolbar.Button
        name="Present fullscreen"
        icon={<Maximize2 className="h-4 w-4" />}
        onClick={onToggleFullscreen}
      />
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
