"use client";

import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
} from "lexical";
import { $getNearestBlockElementAncestorOrThrow } from "@lexical/utils";
import { Toolbar } from "@liveblocks/react-lexical";
import { PaintBucket } from "lucide-react";

const SECTION_COLORS = [
  { label: "None", value: "" },
  { label: "Cream", value: "#f5f0e6" },
  { label: "Mint", value: "#e8f5ef" },
  { label: "Sky", value: "#e8f2fa" },
  { label: "Rose", value: "#fdeef0" },
  { label: "Yellow", value: "#fff8e1" },
];

export function SectionBackgroundButton() {
  const [editor] = useLexicalComposerContext();

  const applyBackground = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchorNode = selection.anchor.getNode();
        const block = $getNearestBlockElementAncestorOrThrow(anchorNode);
        if ($isElementNode(block)) {
          const writable = block.getWritable();
          if (color) {
            writable.setStyle(`background-color: ${color}; padding: 12px; border-radius: 8px;`);
          } else {
            writable.setStyle("");
          }
        }
      });
    },
    [editor]
  );

  return (
    <div className="flex items-center gap-1">
      <Toolbar.Button
        name="Section background"
        icon={<PaintBucket className="h-4 w-4" />}
        onClick={() => applyBackground(SECTION_COLORS[1].value)}
      />
      <select
        className="h-8 rounded border border-[#d5cbb6] bg-white px-2 text-xs"
        onChange={(e) => applyBackground(e.target.value)}
        defaultValue=""
        title="Section background color"
      >
        {SECTION_COLORS.map((c) => (
          <option key={c.label} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
