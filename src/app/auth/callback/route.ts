import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const inviteCode = searchParams.get("invite");
  const claimToken = searchParams.get("claim");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        try {
          await ensureProfile(
            user.id,
            user.email,
            user.user_metadata?.full_name,
            inviteCode,
            claimToken
          );
        } catch {
          // Profile/claim errors still land the user in-app; claim page can retry.
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
