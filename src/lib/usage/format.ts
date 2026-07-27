export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export type UsageLevel = "normal" | "warning" | "critical" | "full";

export function usageLevel(used: number, quota: number): UsageLevel {
  if (quota <= 0) return "normal";
  const pct = used / quota;
  if (pct >= 1) return "full";
  if (pct >= 0.9) return "critical";
  if (pct >= 0.8) return "warning";
  return "normal";
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.min(100, Math.round((used / quota) * 100));
}
