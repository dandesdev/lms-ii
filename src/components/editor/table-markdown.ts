/**
 * Markdown transformer for GitHub-style pipe tables, since @lexical/markdown
 * doesn't ship one. Handles both import (`| a | b |` blocks) and export.
 */

import {
  $convertFromMarkdownString,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type MultilineElementTransformer,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $createParagraphNode, $isElementNode } from "lexical";

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const SEPARATOR_CELL = /^\s*:?-{1,}:?\s*$/;

function parseCells(line: string): string[] | null {
  const match = TABLE_ROW.exec(line);
  if (!match) return null;
  // Split on unescaped pipes.
  return match[1].split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL.test(c));
}

export const TABLE: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  type: "multiline-element",
  regExpStart: TABLE_ROW,
  handleImportAfterStartMatch({ lines, rootNode, startLineIndex }) {
    const rows: string[][] = [];
    let lineIndex = startLineIndex;
    for (; lineIndex < lines.length; lineIndex++) {
      const cells = parseCells(lines[lineIndex]);
      if (!cells) break;
      rows.push(cells);
    }
    const endLineIndex = lineIndex - 1;

    // A lone pipe row isn't a table; let other transformers have it.
    if (rows.length < 2) return null;

    const hasHeader = isSeparatorRow(rows[1]);
    const bodyRows = hasHeader ? [rows[0], ...rows.slice(2)] : rows;
    const columnCount = Math.max(...bodyRows.map((r) => r.length));

    const table = $createTableNode();
    bodyRows.forEach((cells, rowIndex) => {
      const row = $createTableRowNode();
      for (let col = 0; col < columnCount; col++) {
        const isHeader = hasHeader && rowIndex === 0;
        const cell = $createTableCellNode(
          isHeader ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS
        );
        const text = cells[col] ?? "";
        if (text) {
          // Re-run inline markdown (bold, links, …) inside the cell.
          $convertFromMarkdownString(
            text,
            [...TEXT_FORMAT_TRANSFORMERS, ...TEXT_MATCH_TRANSFORMERS],
            cell
          );
        }
        if (cell.getChildrenSize() === 0) {
          cell.append($createParagraphNode());
        }
        row.append(cell);
      }
      table.append(row);
    });
    rootNode.append(table);

    return [true, endLineIndex];
  },
  // Import is fully handled above; typing shortcuts aren't supported.
  replace: () => false,
  export: (node, traverseChildren) => {
    if (!$isTableNode(node)) return null;

    const output: string[] = [];
    let columnCount = 0;
    const rows = node.getChildren().filter($isTableRowNode);

    rows.forEach((row, rowIndex) => {
      const cells = row
        .getChildren()
        .filter($isTableCellNode)
        .map((cell) => {
          let text = "";
          for (const child of cell.getChildren()) {
            if ($isElementNode(child)) {
              if (text) text += " ";
              text += traverseChildren(child);
            }
          }
          return text.replace(/\n/g, " ").replace(/\|/g, "\\|").trim();
        });
      columnCount = Math.max(columnCount, cells.length);
      output.push(`| ${cells.join(" | ")} |`);
      if (rowIndex === 0) {
        output.push(`| ${Array(cells.length).fill("---").join(" | ")} |`);
      }
    });

    return output.join("\n");
  },
};
