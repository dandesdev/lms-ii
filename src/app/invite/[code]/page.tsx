"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InvitePage() {
  const params = useParams();
  const code = String(params.code ?? "");
  const [state, setState] = useState<"loading" | "valid" | "invalid">("loading");
  const [emailHint, setEmailHint] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/invites/${code}`);
      const data = await res.json();
      if (data.valid) {
        setState("valid");
        setEmailHint(data.email ?? null);
      } else {
        setState("invalid");
      }
    })();
  }, [code]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">Checking invite…</p>
      </main>
    );
  }

  if (state === "invalid") {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Invite not available</h1>
        <p className="mt-2 text-muted-foreground">
          This link may be expired, already used, or revoked. Ask the person who invited you for a
          new link.
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary underline">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teacher invite</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create an account or sign in to join as a teacher.
            {emailHint && (
              <p className="mt-2">
                Intended for: <span className="text-foreground">{emailHint}</span>
              </p>
            )}
          </CardContent>
        </Card>
        <LoginForm inviteCode={code} defaultEmail={emailHint ?? undefined} />
      </div>
    </main>
  );
}
