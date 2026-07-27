"use client";

import {
  EDITOR_FONTS,
  getCoreEditorFonts,
  getEditorFontById,
  matchEditorFont,
  type EditorFont,
} from "@/lib/fonts/registry";

const loadedIds = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function googleCssUrl(font: EditorFont): string | null {
  if (!font.googleFamily) return null;
  const family = font.googleFamily.replace(/ /g, "+");
  const axis = font.googleAxis ? `:${font.googleAxis}` : "";
  return `https://fonts.googleapis.com/css2?family=${family}${axis}&display=swap`;
}

function injectStylesheet(href: string, dataId: string): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(
    `link[data-editor-font="${dataId}"]`
  );
  if (existing) return existing;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.editorFont = dataId;
  document.head.appendChild(link);
  return link;
}

async function waitForLink(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) return;
  await new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener(
      "error",
      () => reject(new Error(`Failed to load font stylesheet: ${link.href}`)),
      { once: true }
    );
  });
}

async function waitForFontFace(font: EditorFont): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const family = font.googleFamily ?? font.label;
  try {
    await document.fonts.load(`16px "${family}"`);
  } catch {
    // Some variable fonts resolve slowly; stylesheet injection is enough.
  }
}

async function loadFont(font: EditorFont): Promise<void> {
  if (loadedIds.has(font.id)) return;

  const existing = inflight.get(font.id);
  if (existing) return existing;

  const href = googleCssUrl(font);
  const promise = (async () => {
    if (href) {
      const link = injectStylesheet(href, font.id);
      try {
        await waitForLink(link);
      } catch (err) {
        console.warn("[fonts]", err);
      }
      await waitForFontFace(font);
    }
    loadedIds.add(font.id);
    inflight.delete(font.id);
  })();

  inflight.set(font.id, promise);
  return promise;
}

/** Load a single catalog font by id (no-op if already loaded). */
export async function ensureFontLoaded(idOrFont: string | EditorFont): Promise<void> {
  const font =
    typeof idOrFont === "string" ? getEditorFontById(idOrFont) : idOrFont;
  if (!font) return;
  await loadFont(font);
}

/** Batch-load fonts (e.g. core set or used-in-doc). */
export async function ensureFontsLoaded(
  idsOrFonts: Array<string | EditorFont>
): Promise<void> {
  await Promise.all(idsOrFonts.map((item) => ensureFontLoaded(item)));
}

/** Load every `core: true` editor font. */
export async function ensureCoreEditorFonts(): Promise<void> {
  await ensureFontsLoaded(getCoreEditorFonts());
}

/** Resolve a CSS font-family string and ensure that catalog font is loaded. */
export async function ensureFontForCssFamily(
  fontFamily: string | null | undefined
): Promise<EditorFont | undefined> {
  const font = matchEditorFont(fontFamily);
  if (font) await ensureFontLoaded(font);
  return font;
}

export function isEditorFontLoaded(id: string): boolean {
  return loadedIds.has(id);
}

export { EDITOR_FONTS };
