"use client";

import { useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { Table } from "lucide-react";
import { useStyledSelection } from "./format-plugins";
import { ToolbarPopover } from "./toolbar-ui";
import { cn } from "@/lib/utils";

const MAX_ROWS = 6;
const MAX_COLS = 6;

export function InsertTableButton() {
  const [editor] = useLexicalComposerContext();
  const { withSelection } = useStyledSelection();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ rows: number; cols: number }>({
    rows: 3,
    cols: 3,
  });
  const [withHeader, setWithHeader] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const insert = (rows: number, cols: number) => {
    setOpen(false);
    // Restore the editor selection (the popover stole focus), then insert.
    withSelection(() => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(rows),
        columns: String(cols),
        includeHeaders: { rows: withHeader, columns: false },
      });
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Insert table"
        aria-label="Insert table"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "editor-toolbar-btn",
          open && "editor-toolbar-btn-active"
        )}
      >
        <Table className="h-4 w-4" />
      </button>

      <ToolbarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        className="w-auto p-3"
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {hover.rows} × {hover.cols} table
        </p>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1rem)` }}
          onMouseLeave={() => setHover({ rows: 3, cols: 3 })}
        >
          {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
            const row = Math.floor(i / MAX_COLS) + 1;
            const col = (i % MAX_COLS) + 1;
            const active = row <= hover.rows && col <= hover.cols;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Insert ${row} by ${col} table`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHover({ rows: row, cols: col })}
                onClick={() => insert(row, col)}
                className={cn(
                  "h-4 w-4 rounded-[3px] border transition-colors",
                  active
                    ? "border-[#1e4d3a] bg-[#1e4d3a]/25"
                    : "border-[#ddd0b6] bg-card"
                )}
              />
            );
          })}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={withHeader}
            onChange={(e) => setWithHeader(e.target.checked)}
            className="accent-[#1e4d3a]"
          />
          Header row
        </label>
      </ToolbarPopover>
    </div>
  );
}
