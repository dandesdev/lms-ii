"use client";

import { useState } from "react";
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
import { GraduationCap } from "lucide-react";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        await fetch("/api/auth/ensure-profile", { method: "POST" });
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
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
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
        <p className="mt-3 text-center text-sm text-[#6b6558]">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-[#1e4d3a] underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
        {message && (
          <p className="mt-3 text-center text-sm text-[#6b6558]">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
