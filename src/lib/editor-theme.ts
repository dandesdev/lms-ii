import { getEditorFontById } from "@/lib/fonts/registry";

export type HeadingTag = "h1" | "h2" | "h3" | "h4";

export type HeadingLevelTheme = {
  align?: "left" | "center" | "right" | "justify";
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
};

export type EditorTheme = {
  headings?: Partial<Record<HeadingTag, HeadingLevelTheme>>;
};

/** Architects Daughter — default face for all heading levels. */
export const DEFAULT_HEADING_FONT_FAMILY =
  getEditorFontById("playful")?.cssFamily ??
  '"Architects Daughter", "Fraunces", cursive';

const HEADING_TAGS: HeadingTag[] = ["h1", "h2", "h3", "h4"];

/** App defaults when no class theme is saved for a level. */
export function defaultHeadingTheme(tag: HeadingTag): HeadingLevelTheme {
  return {
    align: "left",
    color: "#000000",
    fontFamily: DEFAULT_HEADING_FONT_FAMILY,
    fontWeight: tag === "h1" ? "700" : "600",
  };
}

export function isHeadingTag(value: string): value is HeadingTag {
  return (HEADING_TAGS as string[]).includes(value);
}

export function headingLabel(tag: HeadingTag): string {
  return `Heading ${tag.slice(1)}`;
}

export function getHeadingTheme(
  theme: EditorTheme | null | undefined,
  tag: HeadingTag
): HeadingLevelTheme {
  return {
    ...defaultHeadingTheme(tag),
    ...theme?.headings?.[tag],
  };
}

export function parseEditorTheme(value: unknown): EditorTheme | null {
  if (!value || typeof value !== "object") return null;
  const headings = (value as EditorTheme).headings;
  if (!headings || typeof headings !== "object") {
    return Object.keys(value as object).length === 0 ? {} : (value as EditorTheme);
  }
  const out: EditorTheme = { headings: {} };
  for (const tag of HEADING_TAGS) {
    const level = headings[tag];
    if (!level || typeof level !== "object") continue;
    out.headings![tag] = sanitizeLevel(level);
  }
  return out;
}

function sanitizeLevel(level: HeadingLevelTheme): HeadingLevelTheme {
  const align = level.align;
  return {
    ...(align === "left" ||
    align === "center" ||
    align === "right" ||
    align === "justify"
      ? { align }
      : {}),
    ...(typeof level.color === "string" && level.color
      ? { color: level.color }
      : {}),
    ...(typeof level.fontFamily === "string" && level.fontFamily
      ? { fontFamily: level.fontFamily }
      : {}),
    ...(typeof level.fontSize === "string" && level.fontSize
      ? { fontSize: level.fontSize }
      : {}),
    ...(typeof level.fontWeight === "string" && level.fontWeight
      ? { fontWeight: level.fontWeight }
      : {}),
  };
}

/** Merge one heading level into an existing theme (null level clears it). */
export function withHeadingTheme(
  theme: EditorTheme | null | undefined,
  tag: HeadingTag,
  level: HeadingLevelTheme | null
): EditorTheme {
  const headings = { ...theme?.headings };
  if (level === null) {
    delete headings[tag];
  } else {
    headings[tag] = sanitizeLevel(level);
  }
  return { ...theme, headings };
}
