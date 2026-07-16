"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type ElementFormatType,
  type NodeKey,
} from "lexical";
import { Crop, Check, X } from "lucide-react";
import { $isImageNode, type ImageCrop } from "./image-node";
import { cn } from "@/lib/utils";

const MIN_DISPLAY_WIDTH = 48;
const MIN_CROP_FRACTION = 0.08;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function alignClass(align: ElementFormatType): string {
  switch (align) {
    case "center":
    case "justify":
      return "mx-auto";
    case "right":
      return "ml-auto";
    default:
      return "mr-auto";
  }
}

const FULL_CROP: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };

function isFullCrop(c: ImageCrop) {
  return c.x <= 0.01 && c.y <= 0.01 && c.width >= 0.99 && c.height >= 0.99;
}

export function ImageComponent({
  src,
  altText,
  width,
  height,
  align,
  crop,
  nodeKey,
}: {
  src: string;
  altText: string;
  width?: number;
  height?: number;
  align: ElementFormatType;
  crop: ImageCrop | null;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [cropping, setCropping] = useState(false);
  const [draftCrop, setDraftCrop] = useState<ImageCrop>(crop ?? FULL_CROP);
  const [natural, setNatural] = useState({
    w: width && height ? width : 0,
    h: width && height ? height : 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);

  const activeCrop = crop ?? FULL_CROP;
  const hasCrop = !isFullCrop(activeCrop);
  const displayWidth = width;

  const aspectFor = (c: ImageCrop, nw: number, nh: number) =>
    nw && nh ? (nw * c.width) / (nh * c.height) : undefined;

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const target = event.target as HTMLElement | null;
          if (
            target &&
            (containerRef.current === target ||
              containerRef.current?.contains(target))
          ) {
            if (!event.shiftKey) clearSelection();
            setSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          if (!isSelected || cropping) return false;
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isImageNode(node)) node.remove();
          });
          return true;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (!isSelected || cropping) return false;
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isImageNode(node)) node.remove();
          });
          return true;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [clearSelection, cropping, editor, isSelected, nodeKey, setSelected]);

  const commitSize = useCallback(
    (nextWidth: number, cropOverride?: ImageCrop | null) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (!$isImageNode(node)) return;
        const c = cropOverride ?? node.getCrop() ?? FULL_CROP;
        const nw = natural.w || nextWidth;
        const nh = natural.h || nextWidth;
        const aspect = (nw * c.width) / (nh * c.height);
        node.setWidthAndHeight(nextWidth, Math.round(nextWidth / aspect));
      });
    },
    [editor, natural.h, natural.w, nodeKey]
  );

  const onResizePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = containerRef.current.offsetWidth;
    const parentWidth =
      containerRef.current.parentElement?.clientWidth ?? startWidth * 2;
    const aspect =
      aspectFor(activeCrop, natural.w, natural.h) ||
      (height && width ? width / height : undefined);

    const onMove = (ev: PointerEvent) => {
      if (!resizing.current || !containerRef.current) return;
      const next = clamp(
        startWidth + (ev.clientX - startX),
        MIN_DISPLAY_WIDTH,
        parentWidth
      );
      containerRef.current.style.width = `${next}px`;
      if (aspect) containerRef.current.style.height = `${next / aspect}px`;
    };

    const onUp = (ev: PointerEvent) => {
      resizing.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const next = clamp(
        startWidth + (ev.clientX - startX),
        MIN_DISPLAY_WIDTH,
        parentWidth
      );
      commitSize(Math.round(next));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startCrop = () => {
    setDraftCrop(activeCrop);
    setCropping(true);
  };

  const applyCrop = () => {
    const next = isFullCrop(draftCrop) ? null : draftCrop;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isImageNode(node)) return;
      node.setCrop(next);
      const w = node.getWidth();
      if (w && natural.w && natural.h) {
        const c = next ?? FULL_CROP;
        const aspect = (natural.w * c.width) / (natural.h * c.height);
        node.setWidthAndHeight(w, Math.round(w / aspect));
      }
    });
    setCropping(false);
  };

  const cancelCrop = () => {
    setDraftCrop(activeCrop);
    setCropping(false);
  };

  const onCropHandle = (
    edge: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
    e: ReactPointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { ...draftCrop };
    const originX = e.clientX;
    const originY = e.clientY;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - originX) / box.width;
      const dy = (ev.clientY - originY) / box.height;
      let { x, y, width: w, height: h } = start;

      if (edge.includes("e")) {
        w = clamp(start.width + dx, MIN_CROP_FRACTION, 1 - start.x);
      }
      if (edge.includes("s")) {
        h = clamp(start.height + dy, MIN_CROP_FRACTION, 1 - start.y);
      }
      if (edge.includes("w")) {
        const nextX = clamp(
          start.x + dx,
          0,
          start.x + start.width - MIN_CROP_FRACTION
        );
        w = start.width + (start.x - nextX);
        x = nextX;
      }
      if (edge.includes("n")) {
        const nextY = clamp(
          start.y + dy,
          0,
          start.y + start.height - MIN_CROP_FRACTION
        );
        h = start.height + (start.y - nextY);
        y = nextY;
      }

      setDraftCrop({
        x,
        y,
        width: clamp(w, MIN_CROP_FRACTION, 1 - x),
        height: clamp(h, MIN_CROP_FRACTION, 1 - y),
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const cropBoxStyle: CSSProperties = {
    left: `${draftCrop.x * 100}%`,
    top: `${draftCrop.y * 100}%`,
    width: `${draftCrop.width * 100}%`,
    height: `${draftCrop.height * 100}%`,
  };

  // Uncropped display: normal flowing <img> so intrinsic ratio is never forced square.
  const useSimpleImg = !cropping && !hasCrop;

  const frameStyle: CSSProperties = useSimpleImg
    ? {
        width: displayWidth ? `${displayWidth}px` : undefined,
        maxWidth: "100%",
        height: "auto",
      }
    : cropping
      ? {
          width: displayWidth ? `${displayWidth}px` : "min(100%, 640px)",
          maxWidth: "100%",
          aspectRatio:
            natural.w && natural.h
              ? `${natural.w} / ${natural.h}`
              : width && height
                ? `${width} / ${height}`
                : undefined,
        }
      : {
          width: displayWidth ? `${displayWidth}px` : "min(100%, 640px)",
          height: height ? `${height}px` : undefined,
          maxWidth: "100%",
          aspectRatio:
            !height && width && natural.w && natural.h
              ? String(aspectFor(activeCrop, natural.w, natural.h))
              : undefined,
        };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative my-4 rounded-md",
        !cropping && "overflow-hidden",
        cropping && "overflow-visible",
        alignClass(align),
        isSelected && !cropping && "ring-2 ring-primary ring-offset-2",
        cropping && "ring-2 ring-[#c45c26] ring-offset-2"
      )}
      style={frameStyle}
    >
      {useSimpleImg ? (
        <img
          src={src}
          alt={altText}
          draggable={false}
          className="block h-auto w-full max-w-none rounded-md"
          style={{
            width: displayWidth ? `${displayWidth}px` : "100%",
            height: "auto",
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      ) : (
        <img
          src={src}
          alt={altText}
          draggable={false}
          className={cn(
            // Preflight clamps img to max-width:100%; crop math needs to
            // oversize the img beyond its frame.
            "max-w-none",
            cropping && "h-full w-full object-contain"
          )}
          style={
            cropping
              ? {
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none",
                  pointerEvents: "none",
                }
              : {
                  position: "absolute",
                  left: `${(-activeCrop.x / activeCrop.width) * 100}%`,
                  top: `${(-activeCrop.y / activeCrop.height) * 100}%`,
                  width: `${(1 / activeCrop.width) * 100}%`,
                  height: `${(1 / activeCrop.height) * 100}%`,
                  maxWidth: "none",
                  userSelect: "none",
                  pointerEvents: "none",
                }
          }
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      )}

      {cropping && (
        <>
          <div
            className="absolute border-2 border-white"
            style={{
              ...cropBoxStyle,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            <div className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-white/55" />
            <div className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-white/55" />
            <div className="pointer-events-none absolute top-1/3 left-0 h-px w-full bg-white/55" />
            <div className="pointer-events-none absolute top-2/3 left-0 h-px w-full bg-white/55" />

            {(
              [
                ["nw", "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"],
                ["ne", "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"],
                ["sw", "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"],
                ["se", "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"],
                ["n", "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"],
                ["s", "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"],
                ["e", "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
                ["w", "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
              ] as const
            ).map(([edge, cls]) => (
              <button
                key={edge}
                type="button"
                aria-label={`Crop ${edge}`}
                className={cn(
                  "absolute z-10 h-3 w-3 rounded-sm border border-white bg-[#c45c26]",
                  cls
                )}
                onPointerDown={(ev) => onCropHandle(edge, ev)}
              />
            ))}
          </div>

          <div className="absolute bottom-2 right-2 z-20 flex gap-1">
            <button
              type="button"
              title="Cancel crop"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelCrop}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-editor-canvas text-editor-ink shadow ring-1 ring-black/10"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Apply crop"
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyCrop}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {isSelected && !cropping && (
        <>
          <button
            type="button"
            title="Crop image"
            onMouseDown={(e) => e.preventDefault()}
            onClick={startCrop}
            className="absolute left-2 top-2 z-10 flex h-7 items-center gap-1 rounded-md bg-editor-canvas/95 px-2 text-xs font-medium text-editor-ink shadow ring-1 ring-black/10 hover:bg-white"
          >
            <Crop className="h-3.5 w-3.5" />
            Crop
          </button>
          <button
            type="button"
            aria-label="Resize image"
            title="Drag to scale (keeps aspect ratio)"
            className="absolute bottom-0 right-0 z-10 h-4 w-4 translate-x-1/3 translate-y-1/3 cursor-nwse-resize rounded-sm border-2 border-white bg-primary shadow"
            onPointerDown={onResizePointerDown}
          />
        </>
      )}
    </div>
  );
}
