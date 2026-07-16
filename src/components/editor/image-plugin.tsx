"use client";

import { useCallback, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $getSelection, $isRangeSelection } from "lexical";
import { $createImageNode } from "./image-node";
import { ImageIcon, Loader2 } from "lucide-react";

export function ImageUploadButton({ classId }: { classId: string }) {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("classId", classId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        // Probe natural size before inserting so the node never flashes square.
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const probe = new Image();
          probe.onload = () =>
            resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
          probe.onerror = () => reject(new Error("Could not read image"));
          probe.src = data.url;
        });

        editor.update(() => {
          const maxW = 720;
          const width = Math.min(dims.w, maxW);
          const height = Math.round((width / dims.w) * dims.h);
          const imageNode = $createImageNode({
            src: data.url,
            altText: file.name,
            width,
            height,
          });
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([imageNode]);
          } else {
            $insertNodes([imageNode]);
          }
        });
      } catch (err) {
        alert(
          `Could not insert the image: ${err instanceof Error ? err.message : "unknown error"}`
        );
      } finally {
        setUploading(false);
      }
    },
    [classId, editor]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title={uploading ? "Uploading image…" : "Insert image"}
        aria-label={uploading ? "Uploading image…" : "Insert image"}
        disabled={uploading}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className="editor-toolbar-btn disabled:opacity-40"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
