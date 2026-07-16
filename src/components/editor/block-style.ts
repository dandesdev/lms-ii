/** Shared style encoding for block-level visual treatments. */

export type BlockVisualStyle = {
  /** Highlight-block fill (padded rounded box). */
  highlightBg?: string;
  /** Highlight-block border color. */
  highlightBorder?: string;
  /** Full-bleed section background (edge-to-edge within the editor pane). */
  sectionBg?: string;
};

function readProp(style: string, prop: string): string | undefined {
  const re = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, "i");
  return re.exec(style)?.[1]?.trim() || undefined;
}

export function parseBlockVisualStyle(style: string): BlockVisualStyle {
  const highlightBg = readProp(style, "background-color");
  const sectionBg = readProp(style, "--section-bg");

  let highlightBorder = readProp(style, "border-color");
  if (!highlightBorder) {
    const border = readProp(style, "border");
    if (border) {
      const color = border.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)\s*$/i)?.[1];
      if (color && color !== "solid" && color !== "none") {
        highlightBorder = color;
      }
    }
  }

  return { highlightBg, highlightBorder, sectionBg };
}

/** Persisted on Lexical nodes and synced over Liveblocks/Yjs. */
export function serializeBlockVisualStyle(visual: BlockVisualStyle): string {
  const parts: string[] = [];
  const hasHighlight = Boolean(visual.highlightBg || visual.highlightBorder);

  if (hasHighlight) {
    if (visual.highlightBg) {
      parts.push(`background-color: ${visual.highlightBg}`);
    }
    if (visual.highlightBorder) {
      parts.push(`border-color: ${visual.highlightBorder}`);
    }
  }

  if (visual.sectionBg) {
    parts.push(`--section-bg: ${visual.sectionBg}`);
  }

  return parts.join("; ");
}

export function parseSectionStyle(style: string): Pick<BlockVisualStyle, "sectionBg"> {
  return { sectionBg: readProp(style, "--section-bg") };
}

export function serializeSectionStyle(
  visual: Pick<BlockVisualStyle, "sectionBg">
): string {
  return visual.sectionBg ? `--section-bg: ${visual.sectionBg}` : "";
}

/**
 * Mirror highlight-block visuals onto block DOM nodes (paragraphs, headings, …).
 * Section backgrounds are painted on `.editor-section` wrappers instead.
 */
export function applyBlockVisualToDom(
  dom: HTMLElement,
  style: string
): void {
  const visual = parseBlockVisualStyle(style);
  const hasHighlight = Boolean(visual.highlightBg || visual.highlightBorder);

  for (const prop of [
    "background-color",
    "padding",
    "border-radius",
    "border",
    "border-color",
    "--highlight-bg",
    "--highlight-border",
    "--section-bg",
  ]) {
    dom.style.removeProperty(prop);
  }

  dom.classList.toggle("editor-highlight-block", hasHighlight);

  const hasSection = Boolean(visual.sectionBg);
  dom.classList.toggle("editor-section-bg", hasSection);
  if (hasSection) {
    dom.style.setProperty("--section-bg", visual.sectionBg!);
  }

  if (hasHighlight) {
    if (visual.highlightBg) {
      dom.style.setProperty("--highlight-bg", visual.highlightBg);
    }
    if (visual.highlightBorder) {
      dom.style.setProperty("--highlight-border", visual.highlightBorder);
    }
  }
}

/** Mirror section background onto `.editor-section` wrapper DOM nodes. */
export function applySectionVisualToDom(
  dom: HTMLElement,
  style: string
): void {
  const { sectionBg } = parseSectionStyle(style);

  dom.style.removeProperty("--section-bg");
  dom.classList.toggle("editor-section-colored", Boolean(sectionBg));

  if (sectionBg) {
    dom.style.setProperty("--section-bg", sectionBg);
  }
}
