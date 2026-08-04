"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Link2, Loader2, RefreshCw, Unlink } from "lucide-react";

export function StudentAccountPanel({
  studentId,
  email,
  claimToken,
  userId,
  linkedEmail,
  claimedAt,
}: {
  studentId: string;
  email: string | null;
  claimToken: string;
  userId: string | null;
  linkedEmail: string | null;
  claimedAt: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(claimToken);
  const [linked, setLinked] = useState(Boolean(userId));
  const [currentLinkedEmail, setCurrentLinkedEmail] = useState(linkedEmail);
  const [currentClaimedAt, setCurrentClaimedAt] = useState(claimedAt);
  const [linkEmail, setLinkEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"link" | "unlink" | "regen" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Sync local optimistic state when server props change (e.g. after router.refresh).
  // Adjust during render instead of in an effect to avoid cascading renders.
  const [prevAccount, setPrevAccount] = useState({
    claimToken,
    userId,
    linkedEmail,
    claimedAt,
  });
  if (
    claimToken !== prevAccount.claimToken ||
    userId !== prevAccount.userId ||
    linkedEmail !== prevAccount.linkedEmail ||
    claimedAt !== prevAccount.claimedAt
  ) {
    setPrevAccount({ claimToken, userId, linkedEmail, claimedAt });
    setToken(claimToken);
    setLinked(Boolean(userId));
    setCurrentLinkedEmail(linkedEmail);
    setCurrentClaimedAt(claimedAt);
  }

  const claimUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/claim/${token}`
      : `/claim/${token}`;

  async function runAction(
    action: "link" | "unlink" | "regenerate_claim",
    body: Record<string, unknown> = {}
  ) {
    setMessage(null);
    setBusy(action === "regenerate_claim" ? "regen" : action);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (typeof data.claim_token === "string") setToken(data.claim_token);
      setLinked(Boolean(data.user_id));
      setCurrentLinkedEmail(
        typeof data.linked_email === "string" ? data.linked_email : null
      );
      setCurrentClaimedAt(
        typeof data.claimed_at === "string" ? data.claimed_at : null
      );
      if (action === "link") setLinkEmail("");
      if (action === "regenerate_claim") {
        setMessage("New claim link generated. Old links no longer work.");
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  function copyClaimLink() {
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Student account
        </CardTitle>
        <Badge variant={linked ? "success" : "warning"}>
          {linked ? "Linked" : "Not linked"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[#6b6558]">
        {!token ? (
          <div className="rounded-md border border-editor-chrome bg-[#fff8e8] px-3 py-2 text-[#1e4d3a]">
            Claim links need a database migration. In the Supabase SQL editor,
            run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/20260731_student_claim_tokens.sql
            </code>
            , then refresh this page.
          </div>
        ) : (
          <p>
            Share the claim link so this student can create an account with any
            email. That account is then linked to this profile.
          </p>
        )}

        {linked ? (
          <div className="rounded-md border border-editor-chrome bg-[#fffdf8] px-3 py-2 text-[#1e4d3a]">
            Linked to{" "}
            <span className="font-medium">
              {currentLinkedEmail ?? "an account"}
            </span>
            {currentClaimedAt ? (
              <span className="text-[#6b6558]">
                {" "}
                · since {new Date(currentClaimedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        ) : (
          <p>
            Contact email on file:{" "}
            <span className="text-[#1e4d3a]">
              {email?.trim() ? email : "none"}
            </span>
            . This does not need to match the email they sign up with.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyClaimLink}
            disabled={!token}
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy claim link"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!token || busy !== null}
            onClick={() => {
              if (
                confirm(
                  "Generate a new claim link? The previous link will stop working."
                )
              ) {
                void runAction("regenerate_claim");
              }
            }}
          >
            {busy === "regen" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>
          {linked && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                if (
                  confirm(
                    "Unlink this account? The student will lose portal access until linked again."
                  )
                ) {
                  void runAction("unlink");
                }
              }}
            >
              {busy === "unlink" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Unlink
            </Button>
          )}
        </div>

        {!linked && (
          <div className="space-y-2 border-t border-[#e8e0d0] pt-4">
            <p className="font-medium text-[#1e4d3a]">
              Link an existing account
            </p>
            <p>
              If they already signed up with a different email, enter that
              login email here.
            </p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runAction("link", { email: linkEmail });
              }}
            >
              <Input
                type="email"
                placeholder="Student login email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                className="min-w-55 flex-1"
                required
              />
              <Button type="submit" size="sm" disabled={busy !== null}>
                {busy === "link" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Link account
              </Button>
            </form>
          </div>
        )}

        {message && <p className="text-[#1e4d3a]">{message}</p>}
      </CardContent>
    </Card>
  );
}
