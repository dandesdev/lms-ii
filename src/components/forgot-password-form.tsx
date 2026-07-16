"use client";

import { useState } from "react";
import Link from "next/link";
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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      setMessage(
        "If an account exists for that email, we sent a reset link. Check your inbox."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#1e4d3a]" />
          Reset password
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-[#6b6558]">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-[#6b6558]">
              Enter your email and we&apos;ll send a link to choose a new password.
            </p>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        {message && !sent && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">{message}</p>
        )}
        <p className="mt-3 text-center text-sm text-[#6b6558]">
          <Link href="/login" className="font-medium text-[#1e4d3a] underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
