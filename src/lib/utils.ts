import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractTitleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

export function filenameToTitle(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  const parts = base.split("_");
  if (parts.length > 1) {
    return parts.slice(1).join(" ").replace(/-/g, " ");
  }
  return base.replace(/-/g, " ");
}
