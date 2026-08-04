"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  parseEditorTheme,
  withHeadingTheme,
  type EditorTheme,
  type HeadingLevelTheme,
  type HeadingTag,
} from "@/lib/editor-theme";

type HeadingThemeContextValue = {
  theme: EditorTheme;
  setLevelTheme: (
    tag: HeadingTag,
    level: HeadingLevelTheme | null
  ) => EditorTheme;
  persistTheme: (next: EditorTheme) => Promise<void>;
};

const HeadingThemeContext = createContext<HeadingThemeContextValue | null>(
  null
);

export function HeadingThemeProvider({
  classId,
  initialTheme,
  children,
}: {
  classId: string;
  initialTheme?: EditorTheme | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<EditorTheme>(
    () => parseEditorTheme(initialTheme) ?? {}
  );

  const persistTheme = useCallback(
    async (next: EditorTheme) => {
      setTheme(next);
      try {
        await fetch(`/api/classes/${classId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editor_theme: next }),
        });
      } catch {
        // Local apply still succeeded; persistence can retry on next change.
      }
    },
    [classId]
  );

  const setLevelTheme = useCallback(
    (tag: HeadingTag, level: HeadingLevelTheme | null) => {
      const next = withHeadingTheme(theme, tag, level);
      void persistTheme(next);
      return next;
    },
    [theme, persistTheme]
  );

  const value = useMemo(
    () => ({ theme, setLevelTheme, persistTheme }),
    [theme, setLevelTheme, persistTheme]
  );

  return (
    <HeadingThemeContext.Provider value={value}>
      {children}
    </HeadingThemeContext.Provider>
  );
}

export function useHeadingTheme() {
  const ctx = useContext(HeadingThemeContext);
  if (!ctx) {
    throw new Error("useHeadingTheme must be used within HeadingThemeProvider");
  }
  return ctx;
}

export function useHeadingThemeOptional() {
  return useContext(HeadingThemeContext);
}
