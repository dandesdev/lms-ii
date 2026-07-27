"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Globe, Loader2, Play } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import type { ClassStatus } from "@/types/database";

export function PublishControls({
  classId,
  status,
  shareToken,
  startedAt,
}: {
  classId: string;
  status: ClassStatus;
  shareToken: string;
  startedAt: string | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentStartedAt, setCurrentStartedAt] = useState(startedAt);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${shareToken}`
      : `/c/${shareToken}`;

  async function publish() {
    setLoading(true);
    const previous = currentStatus;
    // Optimistic UI — badge/share controls update as soon as the request is
    // in flight; roll back if the PATCH fails.
    setCurrentStatus("published");
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      // Soft-refresh so Activity-preserved list/dashboard pick up the badge.
      router.refresh();
    } catch (err) {
      setCurrentStatus(previous);
      alert(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  }

  async function unpublish() {
    setLoading(true);
    const previous = currentStatus;
    setCurrentStatus("draft");
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch (err) {
      setCurrentStatus(previous);
      alert(err instanceof Error ? err.message : "Failed to unpublish");
    } finally {
      setLoading(false);
    }
  }

  async function markStarted() {
    setStarting(true);
    const previous = currentStartedAt;
    const optimistic = new Date().toISOString();
    setCurrentStartedAt(optimistic);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ started: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as started");
      if (typeof data.started_at === "string") {
        setCurrentStartedAt(data.started_at);
      }
      router.refresh();
    } catch (err) {
      setCurrentStartedAt(previous);
      alert(err instanceof Error ? err.message : "Failed to mark as started");
    } finally {
      setStarting(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={currentStatus === "published" ? "success" : "warning"}>
        {currentStatus}
      </Badge>

      {currentStartedAt ? (
        <span className="text-xs text-[#6b6558]" title="Started">
          Started {formatShortDate(currentStartedAt)}
        </span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={markStarted}
          disabled={starting}
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Mark started
        </Button>
      )}

      {currentStatus === "draft" ? (
        <Button size="sm" onClick={publish} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Publish
        </Button>
      ) : currentStatus === "published" ? (
        <>
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy share link"}
          </Button>
          <Button size="sm" variant="ghost" onClick={unpublish} disabled={loading}>
            Unpublish
          </Button>
        </>
      ) : null}
    </div>
  );
}
