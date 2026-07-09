"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Globe, Loader2 } from "lucide-react";
import type { ClassStatus } from "@/types/database";

export function PublishControls({
  classId,
  status,
  shareToken,
}: {
  classId: string;
  status: ClassStatus;
  shareToken: string;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${shareToken}`
      : `/c/${shareToken}`;

  async function publish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentStatus("published");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  }

  async function unpublish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) throw new Error("Failed");
      setCurrentStatus("draft");
      router.refresh();
    } finally {
      setLoading(false);
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

      {currentStatus === "draft" ? (
        <Button size="sm" onClick={publish} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Publish
        </Button>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy share link"}
          </Button>
          <Button size="sm" variant="ghost" onClick={unpublish} disabled={loading}>
            Unpublish
          </Button>
        </>
      )}
    </div>
  );
}
