"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Loader2 } from "lucide-react";
import { formatBytes, type UsageLevel } from "@/lib/usage/format";
import { cn } from "@/lib/utils";

interface UsagePayload {
  usage: {
    markdown_bytes: number;
    image_bytes: number;
    snapshot_bytes: number;
    total_bytes: number;
  };
  plan: { label: string; quota_bytes: number };
  level: UsageLevel;
  percent: number;
  topClasses: Array<{
    class_id: string;
    title: string;
    student_name: string;
    total_bytes: number;
  }>;
}

const LEVEL_STYLES: Record<UsageLevel, string> = {
  normal: "bg-primary",
  warning: "bg-[#8a5a10]",
  critical: "bg-[#a3341f]",
  full: "bg-destructive",
};

export function UsagePanel() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading space…
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load cloud space.</p>;
  }

  const { usage, plan, level, percent, topClasses } = data;
  const segments = [
    { label: "Class text", bytes: usage.markdown_bytes, color: "bg-[#1e4d3a]" },
    { label: "Images", bytes: usage.image_bytes, color: "bg-[#5b3d84]" },
    { label: "Snapshot", bytes: usage.snapshot_bytes, color: "bg-[#8a5a10]" },
  ];

  return (
    <div className={cn("space-y-3", level !== "normal" && "rounded-md border border-[#8a5a10]/40 p-3")}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <HardDrive className="h-4 w-4 text-primary" />
        Cloud space — {plan.label}
      </div>
      <div>
        <div className="mb-1 flex justify-between font-mono text-[11px]">
          <span>
            {formatBytes(usage.total_bytes)} of {formatBytes(plan.quota_bytes)}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
          {segments.map((s) =>
            s.bytes > 0 ? (
              <div
                key={s.label}
                className={cn(s.color, "h-full")}
                style={{ width: `${(s.bytes / plan.quota_bytes) * 100}%` }}
                title={`${s.label}: ${formatBytes(s.bytes)}`}
              />
            ) : null
          )}
          {percent < 100 && (
            <div
              className={cn("h-full flex-1", LEVEL_STYLES[level])}
              style={{ maxWidth: `${percent}%` }}
            />
          )}
        </div>
      </div>
      {level !== "normal" && (
        <p className="text-xs text-muted-foreground">
          {level === "full"
            ? "Storage full — new uploads and imports are blocked."
            : level === "critical"
              ? "Almost full — consider archiving old classes."
              : "Approaching your plan limit."}{" "}
          <Link href="/docs/getting-started#space" className="text-primary underline">
            How to free space
          </Link>
        </p>
      )}
      {topClasses.length > 0 && (
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Largest classes
          </p>
          <ul className="space-y-1 text-xs">
            {topClasses.slice(0, 4).map((c) => (
              <li key={c.class_id} className="flex justify-between gap-2">
                <Link href={`/class/${c.class_id}`} className="truncate hover:underline">
                  {c.title}
                </Link>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatBytes(c.total_bytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
