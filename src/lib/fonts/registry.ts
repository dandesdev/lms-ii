export type EditorFont = {
  /** Stable id used by loaders and the picker. */
  id: string;
  /** Label shown in the font family picker. */
  label: string;
  /**
   * CSS `font-family` value stored on Lexical text styles.
   * `null` means the editor default (Inter via CSS) — no inline style.
   */
  cssFamily: string | null;
  /** Google Fonts family name for the CSS2 API (omit for system/default). */
  googleFamily?: string;
  /** Axis / weight query segment for Google Fonts, e.g. `wght@400;700`. */
  googleAxis?: string;
  /** Always load on editor routes (avoids FOUT for the default face). */
  core?: boolean;
};

/**
 * Editor font catalog. Add new families here — root layout stays UI-only.
 * Mark `core: true` for fonts that should load as soon as /class or /c opens.
 */
export const EDITOR_FONTS: EditorFont[] = [
  {
    id: "inter",
    label: "Inter",
    cssFamily: null,
    googleFamily: "Inter",
    googleAxis: "ital,opsz,wght@0,14..32,100..900;1,14..32,100..900",
    core: true,
  },
  {
    id: "roboto",
    label: "Roboto",
    cssFamily: "Roboto, sans-serif",
    googleFamily: "Roboto",
    googleAxis: "ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400;1,700",
  },
  {
    id: "lobster",
    label: "Lobster",
    cssFamily: "Lobster, cursive",
    googleFamily: "Lobster",
  },
];

export function getCoreEditorFonts(): EditorFont[] {
  return EDITOR_FONTS.filter((f) => f.core);
}

export function getEditorFontById(id: string): EditorFont | undefined {
  return EDITOR_FONTS.find((f) => f.id === id);
}

/** Match a stored/computed font-family string to a registry entry. */
export function matchEditorFont(
  fontFamily: string | null | undefined
): EditorFont | undefined {
  if (!fontFamily || !fontFamily.trim()) {
    return getEditorFontById("inter");
  }
  const lower = fontFamily.toLowerCase();
  return EDITOR_FONTS.find((f) => {
    if (f.cssFamily && lower.includes(f.label.toLowerCase())) return true;
    if (f.googleFamily && lower.includes(f.googleFamily.toLowerCase())) {
      return true;
    }
    return false;
  });
}
