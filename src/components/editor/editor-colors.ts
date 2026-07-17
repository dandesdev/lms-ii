/** Color math for Mark Up Mode smart defaults (A/B/C) derived from a background. */

export type Rgb = { r: number; g: number; b: number };

export function parseColorToRgb(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === "transparent") return null;

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = value.match(
    /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i
  );
  if (rgb) {
    return {
      r: Math.round(parseFloat(rgb[1]!)),
      g: Math.round(parseFloat(rgb[2]!)),
      b: Math.round(parseFloat(rgb[3]!)),
    };
  }

  return null;
}

export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** WCAG-ish relative luminance (0 dark → 1 light). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export type MarkUpColors = {
  /** A — hot, moderately contrasting highlight (e.g. electric yellow on white). */
  highlight: string;
  /** B — desaturated, moderately contrasting vignette color for the frame. */
  vignette: string;
  /** C — contrasts with both the background and A; mark up text color. */
  textColor: string;
};

/**
 * Derive Mark Up Mode colors from the (first section) background color.
 * Falls back to a white background when the input can't be parsed.
 */
export function deriveMarkUpColors(bg: Rgb | null): MarkUpColors {
  const base = bg ?? { r: 255, g: 255, b: 255 };
  const lum = relativeLuminance(base);
  const isLight = lum > 0.5;

  // A — hot highlight. Warm hue, high saturation, lightness offset from bg.
  // On light backgrounds this lands near electric yellow.
  const aHue = isLight ? 58 : 48;
  const aLight = isLight ? 0.5 : 0.62;
  const highlight = rgbToCss(hslToRgb(aHue, 1, aLight));

  // B — desaturated gray for the vignette/frame; strong contrast so the
  // Mark Up Mode state is unmistakable.
  const bLight = isLight
    ? Math.max(0.16, lum - 0.55)
    : Math.min(0.84, lum + 0.55);
  const vignette = rgbToCss(hslToRgb(0, 0.08, bLight));

  // C — cool hue contrasting bg and the warm A; mark up text color.
  const cHue = 222;
  const cLight = isLight ? 0.32 : 0.7;
  const textColor = rgbToCss(hslToRgb(cHue, 0.75, cLight));

  return { highlight, vignette, textColor };
}
