import {
  $getRoot,
  $isElementNode,
  type ElementFormatType,
  type LexicalNode,
  type TextNode,
} from "lexical";
import { $isHeadingNode, type HeadingNode } from "@lexical/rich-text";
import {
  DEFAULT_HEADING_FONT_FAMILY,
  defaultHeadingTheme,
  type HeadingLevelTheme,
  type HeadingTag,
} from "@/lib/editor-theme";

function readStyleProp(style: string, prop: string): string | undefined {
  const re = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, "i");
  return re.exec(style)?.[1]?.trim() || undefined;
}

function writeStyleProps(
  style: string,
  patch: Record<string, string | null | undefined>
): string {
  const map = new Map<string, string>();
  for (const part of style.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    if (key) map.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    const k = key.toLowerCase();
    if (value === null || value === undefined || value === "") {
      map.delete(k);
    } else {
      map.set(k, value);
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

function normalizeAlign(
  format: ElementFormatType | ""
): HeadingLevelTheme["align"] {
  switch (format) {
    case "center":
    case "right":
    case "justify":
      return format;
    case "end":
      return "right";
    default:
      return "left";
  }
}

/** Read the effective style from a heading (uses first text node as source). */
export function $captureHeadingStyle(heading: HeadingNode): HeadingLevelTheme {
  const tag = heading.getTag() as HeadingTag;
  const defaults = defaultHeadingTheme(tag);
  const texts = heading.getAllTextNodes();
  const sample = texts[0];
  const style = sample?.getStyle() ?? "";

  const color = readStyleProp(style, "color") ?? defaults.color;
  const fontFamily =
    readStyleProp(style, "font-family") ?? DEFAULT_HEADING_FONT_FAMILY;
  const fontSize = readStyleProp(style, "font-size");
  const fontWeightFromStyle = readStyleProp(style, "font-weight");
  const bold = texts.some((t) => t.hasFormat("bold"));
  const fontWeight =
    fontWeightFromStyle ??
    (bold ? "700" : defaults.fontWeight);

  return {
    align: normalizeAlign(heading.getFormatType()),
    color,
    fontFamily,
    ...(fontSize ? { fontSize } : {}),
    fontWeight,
  };
}

function $patchTextNodeStyle(
  node: TextNode,
  theme: HeadingLevelTheme,
  { clearSize }: { clearSize?: boolean } = {}
) {
  const next = writeStyleProps(node.getStyle(), {
    color: theme.color,
    "font-family": theme.fontFamily,
    "font-weight": theme.fontWeight,
    "font-size": clearSize ? null : theme.fontSize,
  });
  node.setStyle(next);

  // Keep Lexical bold flag in sync with explicit theme weight.
  if (theme.fontWeight === "700" || theme.fontWeight === "bold") {
    if (!node.hasFormat("bold")) node.toggleFormat("bold");
  } else if (theme.fontWeight && node.hasFormat("bold")) {
    node.toggleFormat("bold");
  }
}

/** Apply a level theme to one heading node (block align + all text styles). */
export function $applyThemeToHeading(
  heading: HeadingNode,
  theme: HeadingLevelTheme,
  options?: { clearSize?: boolean }
) {
  heading.setFormat(theme.align ?? "left");
  const texts = heading.getAllTextNodes();
  if (texts.length === 0) {
    // Empty heading — style will apply when text is typed via transform.
    return;
  }
  for (const text of texts) {
    $patchTextNodeStyle(text, theme, options);
  }
}

/** Apply theme to every heading of the given tag in the document. */
export function $applyThemeToAllHeadings(
  tag: HeadingTag,
  theme: HeadingLevelTheme,
  options?: { clearSize?: boolean }
): number {
  let count = 0;
  const visit = (node: LexicalNode) => {
    if ($isHeadingNode(node) && node.getTag() === tag) {
      $applyThemeToHeading(node, theme, options);
      count++;
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) visit(child);
    }
  };
  visit($getRoot());
  return count;
}

export function headingHasCustomStyle(
  heading: HeadingNode,
  theme: HeadingLevelTheme
): boolean {
  const captured = $captureHeadingStyle(heading);
  return (
    captured.align !== (theme.align ?? "left") ||
    (captured.color ?? "") !== (theme.color ?? "") ||
    (captured.fontFamily ?? "") !== (theme.fontFamily ?? "") ||
    (captured.fontSize ?? "") !== (theme.fontSize ?? "") ||
    (captured.fontWeight ?? "") !== (theme.fontWeight ?? "")
  );
}

/** True when a text node inside a heading is missing the theme font. */
export function textNeedsHeadingTheme(
  node: TextNode,
  theme: HeadingLevelTheme
): boolean {
  const style = node.getStyle();
  const family = readStyleProp(style, "font-family");
  if (!family && theme.fontFamily) return true;
  if (theme.color && !readStyleProp(style, "color")) return true;
  return false;
}

export function $ensureTextMatchesHeadingTheme(
  node: TextNode,
  theme: HeadingLevelTheme
) {
  if (!textNeedsHeadingTheme(node, theme)) return;
  $patchTextNodeStyle(node, {
    color: theme.color ?? readStyleProp(node.getStyle(), "color"),
    fontFamily:
      theme.fontFamily ??
      readStyleProp(node.getStyle(), "font-family") ??
      DEFAULT_HEADING_FONT_FAMILY,
    fontWeight:
      theme.fontWeight ?? readStyleProp(node.getStyle(), "font-weight"),
    fontSize: readStyleProp(node.getStyle(), "font-size") ?? theme.fontSize,
  });
}

export function $isTextNodeInHeading(node: TextNode): HeadingNode | null {
  let parent: LexicalNode | null = node.getParent();
  while (parent) {
    if ($isHeadingNode(parent)) return parent;
    parent = parent.getParent();
  }
  return null;
}
