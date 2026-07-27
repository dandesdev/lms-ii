"use client";

import { useEffect, useState } from "react";
import { PaperLoadingSheet } from "@/components/paper-loading-sheet";

/**
 * Wall-clock progress that asymptotes toward ~90% — never claims "done" and
 * never holds the UI waiting for 100%. When Next.js swaps `loading.tsx` out,
 * this unmounts immediately.
 */
function useElapsedRouteProgress(statusCount: number) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - started);
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // ~900ms time constant → feels responsive on fast loads, still moves on slow ones.
  const progress = 90 * (1 - Math.exp(-elapsedMs / 900));
  const statusIndex = Math.min(
    statusCount - 1,
    Math.floor(elapsedMs / 550)
  );

  return { progress, statusIndex };
}

/**
 * Shared route `loading.tsx` screen. Status lines are labels only — they do
 * not gate progress or extend the wait.
 */
export function RouteLoading({
  title,
  statuses,
}: {
  title: string;
  statuses: readonly string[];
}) {
  const { progress, statusIndex } = useElapsedRouteProgress(statuses.length);
  const status = statuses[statusIndex] ?? statuses[0] ?? "Loading…";

  return (
    <PaperLoadingSheet
      fullscreen={false}
      title={title}
      status={status}
      progress={progress}
    />
  );
}
