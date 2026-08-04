"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ClaimState =
  | { status: "loading" }
  | { status: "invalid" }
  | {
      status: "valid";
      studentName: string;
      alreadyClaimed: boolean;
    };

export default function ClaimPage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const router = useRouter();
  const [state, setState] = useState<ClaimState>({ status: "loading" });
  const [checkingSession, setCheckingSession] = useState(true);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/claims/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.valid) {
        setState({
          status: "valid",
          studentName: data.studentName,
          alreadyClaimed: Boolean(data.alreadyClaimed),
        });
      } else {
        setState({ status: "invalid" });
        setCheckingSession(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (state.status !== "valid") return;

    let cancelled = false;
    setCheckingSession(true);

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimToken: token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setClaimError(
              typeof data.error === "string"
                ? data.error
                : "Could not link this account."
            );
            setCheckingSession(false);
          }
          return;
        }
        router.replace("/student");
        router.refresh();
      } catch {
        if (!cancelled) {
          setClaimError("Could not link this account.");
          setCheckingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, token, router]);

  if (state.status === "loading" || checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">
          {state.status === "valid"
            ? "Linking your account…"
            : "Checking claim link…"}
        </p>
      </main>
    );
  }

  if (state.status === "invalid") {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">
          Claim link not available
        </h1>
        <p className="mt-2 text-muted-foreground">
          This link may be invalid or was replaced by your teacher. Ask them
          for a new claim link.
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Create an account or sign in to link yourself as{" "}
              <span className="font-medium text-foreground">
                {state.studentName}
              </span>
              . You can use any email address.
            </p>
            {state.alreadyClaimed && (
              <p>
                This profile is already linked. Sign in with the linked account
                to open your classes. A different account cannot take it over.
              </p>
            )}
            {claimError && (
              <div className="space-y-3 rounded-md border border-editor-chrome bg-[#fffdf8] p-3 text-[#1e4d3a]">
                <p>{claimError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setClaimError(null);
                  }}
                >
                  Sign out and try another account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <LoginForm claimToken={token} next="/student" />
      </div>
    </main>
  );
}
