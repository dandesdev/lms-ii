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

/** Concise date for class lists, e.g. "Jul 25" or "Jul 25, 2025". */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
