"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { ClassOpeningLoading } from "@/components/class-opening-loading";

function EditorChunkFallback() {
  const { isActive } = useClassBoot();
  // Create / open boot already covers the screen — don't stack a second sheet.
  if (isActive) return null;
  return <ClassOpeningLoading />;
}

/**
 * Code-split the Lexical + Liveblocks editor so /class and /c routes can paint
 * a light shell while the heavy chunk downloads. ssr:false avoids shipping
 * editor work into the RSC payload.
 */
export const ClassEditorLazy = dynamic(
  () =>
    import("./class-editor").then((mod) => ({ default: mod.ClassEditor })),
  { ssr: false, loading: () => <EditorChunkFallback /> }
);

export type ClassEditorLazyProps = ComponentProps<typeof ClassEditorLazy>;
