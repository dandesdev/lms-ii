"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, GraduationCap } from "lucide-react";

type LoginFormProps = {
  next?: string;
  inviteCode?: string;
  defaultEmail?: string;
};

export function LoginForm({ next, inviteCode, defaultEmail }: LoginFormProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const allowTeacherSignup = Boolean(inviteCode);
  const [mode, setMode] = useState<"login" | "signup">(
    inviteCode ? "signup" : "login"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail]);

  async function ensureProfileWithInvite() {
    await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode ?? null }),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    try {
      if (mode === "signup") {
        if (!allowTeacherSignup) {
          throw new Error("Teacher accounts require an invite link.");
        }
        const inviteQuery = inviteCode
          ? `&invite=${encodeURIComponent(inviteCode)}`
          : "";
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/")}${inviteQuery}`,
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm signup.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await ensureProfileWithInvite();
        router.push(next || "/");
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#1e4d3a]" />
          English LMS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6b6558] hover:text-[#1e4d3a]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {mode === "login" && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">
            <Link
              href="/forgot-password"
              className="font-medium text-[#1e4d3a] underline"
            >
              Forgot password?
            </Link>
          </p>
        )}
        {allowTeacherSignup && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">
            {mode === "login" ? "New teacher?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-[#1e4d3a] underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        )}
        {!allowTeacherSignup && mode === "login" && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">
            Teacher accounts are invite-only. Students sign in with the email their teacher added.
          </p>
        )}
        {message && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
