"use client";

import { useEffect } from "react";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { useIsEditorReady } from "./class-liveblocks-plugin";
import { useIsEditorSynchronized } from "./use-is-editor-synchronized";

/**
 * Reports editor readiness to the class boot overlay. Finishes as soon as Yjs
 * is synchronized — no artificial settle delay.
 */
export function ClassBootCompleter() {
  const boot = useClassBoot();
  const isReady = useIsEditorReady();
  const isSynchronized = useIsEditorSynchronized();

  useEffect(() => {
    if (isReady) boot.advance("sync");
  }, [boot, isReady]);

  useEffect(() => {
    if (isSynchronized) boot.finish();
  }, [boot, isSynchronized]);

  return null;
}
