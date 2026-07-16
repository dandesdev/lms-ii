"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await fetch("/api/auth/ensure-profile", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#1e4d3a]" />
          Choose a new password
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasSession ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[#6b6558]">
            This reset link is invalid or has expired. Request a new one from the
            forgot password page.
          </p>
        )}
        {message && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">{message}</p>
        )}
        <p className="mt-3 text-center text-sm text-[#6b6558]">
          {hasSession ? (
            <Link href="/login" className="font-medium text-[#1e4d3a] underline">
              Back to sign in
            </Link>
          ) : (
            <Link
              href="/forgot-password"
              className="font-medium text-[#1e4d3a] underline"
            >
              Request a new reset link
            </Link>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
