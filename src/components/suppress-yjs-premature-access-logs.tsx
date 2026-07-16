"use client";

import { useEffect } from "react";

/**
 * Suppresses the known upstream Yjs warning:
 * "Invalid access: Add Yjs type to a document before reading data."
 *
 * Triggered by @lexical/yjs reading attributes on newly created XmlText/XmlElement
 * before they are attached to a Y.Doc. The read returns undefined (correct for a
 * new node); the warn is noise. See bug-hunts/yjs-lexical-collab/.
 *
 * Root layout also installs an early <head> filter so Next.js browser→server log
 * forwarding does not flood the terminal before React mounts.
 */
const NEEDLE =
  "Invalid access: Add Yjs type to a document before reading data";

function shouldSuppress(args: unknown[]): boolean {
  for (const arg of args) {
    if (typeof arg === "string" && arg.includes(NEEDLE)) return true;
    if (
      arg !== null &&
      typeof arg === "object" &&
      "message" in arg &&
      typeof (arg as { message: unknown }).message === "string" &&
      (arg as { message: string }).message.includes(NEEDLE)
    ) {
      return true;
    }
  }
  return false;
}

type ConsoleMethod = (...args: unknown[]) => void;

function wrapConsoleMethod(original: ConsoleMethod): ConsoleMethod {
  return (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    original.apply(console, args);
  };
}

export function SuppressYjsPrematureAccessLogs() {
  useEffect(() => {
    // Skip if the early <head> script already wrapped console.
    if (
      typeof window !== "undefined" &&
      (window as Window & { __yjsPrematureAccessFiltered?: boolean })
        .__yjsPrematureAccessFiltered
    ) {
      return;
    }

    const originals = {
      warn: console.warn.bind(console) as ConsoleMethod,
      error: console.error.bind(console) as ConsoleMethod,
      log: console.log.bind(console) as ConsoleMethod,
    };

    console.warn = wrapConsoleMethod(originals.warn);
    console.error = wrapConsoleMethod(originals.error);
    console.log = wrapConsoleMethod(originals.log);

    return () => {
      console.warn = originals.warn;
      console.error = originals.error;
      console.log = originals.log;
    };
  }, []);

  return null;
}
