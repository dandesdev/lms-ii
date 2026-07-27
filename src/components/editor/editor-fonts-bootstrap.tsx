"use client";

import { useEffect } from "react";
import { ensureCoreEditorFonts } from "@/lib/fonts/ensure-font";

/** Eagerly load `core: true` editor fonts when a class editor mounts. */
export function EditorFontsBootstrap() {
  useEffect(() => {
    void ensureCoreEditorFonts();
  }, []);
  return null;
}
