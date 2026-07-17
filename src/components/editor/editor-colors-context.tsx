"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  deriveMarkUpColors,
  parseColorToRgb,
  type MarkUpColors,
} from "./editor-colors";

type EditorColorsContextValue = {
  /** A — default highlight color (updates to the last user highlight pick). */
  highlightColor: string;
  /** C — default mark up/text color (updates to the last user text pick). */
  textColor: string;
  /** B — vignette/frame color shown while in Mark Up Mode. */
  vignetteColor: string;
  setHighlightColor: (color: string) => void;
  setTextColor: (color: string) => void;
};

const FALLBACK: MarkUpColors = deriveMarkUpColors({ r: 255, g: 255, b: 255 });

const EditorColorsContext = createContext<EditorColorsContextValue>({
  highlightColor: FALLBACK.highlight,
  textColor: FALLBACK.textColor,
  vignetteColor: FALLBACK.vignette,
  setHighlightColor: () => {},
  setTextColor: () => {},
});

export function EditorColorsProvider({ children }: { children: ReactNode }) {
  const [highlightColor, setHighlightColorState] = useState(FALLBACK.highlight);
  const [textColor, setTextColorState] = useState(FALLBACK.textColor);
  const [vignetteColor, setVignetteColor] = useState(FALLBACK.vignette);

  // Once smart defaults are computed we stop overriding user choices.
  const highlightPinned = useRef(false);
  const textPinned = useRef(false);

  const setHighlightColor = useCallback((color: string) => {
    highlightPinned.current = true;
    setHighlightColorState(color);
  }, []);

  const setTextColor = useCallback((color: string) => {
    textPinned.current = true;
    setTextColorState(color);
  }, []);

  const applyFromBackground = useCallback((bgCss: string | null) => {
    const derived = deriveMarkUpColors(parseColorToRgb(bgCss));
    setVignetteColor(derived.vignette);
    if (!highlightPinned.current) setHighlightColorState(derived.highlight);
    if (!textPinned.current) setTextColorState(derived.textColor);
  }, []);

  const value = useMemo(
    () => ({
      highlightColor,
      textColor,
      vignetteColor,
      setHighlightColor,
      setTextColor,
    }),
    [highlightColor, textColor, vignetteColor, setHighlightColor, setTextColor]
  );

  return (
    <EditorColorsContext.Provider value={value}>
      <BackgroundColorProbe onResolve={applyFromBackground} />
      {children}
    </EditorColorsContext.Provider>
  );
}

/**
 * Reads the first section's effective background color after mount and feeds it
 * to the provider so smart Mark Up Mode colors can be derived on page load.
 */
function BackgroundColorProbe({
  onResolve,
}: {
  onResolve: (bgCss: string | null) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    let raf = 0;
    let tries = 0;

    const probe = () => {
      tries += 1;
      const root = editor.getRootElement();
      const section = root?.querySelector<HTMLElement>(".editor-section");
      if (section) {
        const sectionBg = getComputedStyle(section).backgroundColor;
        const isTransparent =
          !sectionBg ||
          sectionBg === "transparent" ||
          sectionBg === "rgba(0, 0, 0, 0)";
        const contentBg = root
          ? getComputedStyle(root).backgroundColor
          : null;
        onResolve(isTransparent ? contentBg : sectionBg);
        done.current = true;
        return;
      }
      if (tries < 40) raf = window.requestAnimationFrame(probe);
    };

    raf = window.requestAnimationFrame(probe);
    return () => window.cancelAnimationFrame(raf);
  }, [editor, onResolve]);

  return null;
}

export function useEditorColors() {
  return useContext(EditorColorsContext);
}
