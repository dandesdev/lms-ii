"use client";

import { useCallback, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, $getSelection, $isRangeSelection } from "lexical";
import { $createImageNode } from "./image-node";
import { Toolbar } from "@liveblocks/react-lexical";
import { ImageIcon } from "lucide-react";

export function ImageUploadButton({ classId }: { classId: string }) {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classId", classId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      editor.update(() => {
        const imageNode = $createImageNode({
          src: data.url,
          altText: file.name,
        });
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertNodes([imageNode]);
        } else {
          $insertNodes([imageNode]);
        }
      });
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
          if (file) upload(file).catch(console.error);
          e.target.value = "";
        }}
      />
      <Toolbar.Button
        name="Insert image"
        icon={<ImageIcon className="h-4 w-4" />}
        onClick={() => inputRef.current?.click()}
      />
    </>
  );
}
