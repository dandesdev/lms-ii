import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let inviteCode: string | null = null;
  let claimToken: string | null = null;
  try {
    const body = await request.json();
    if (typeof body.inviteCode === "string") inviteCode = body.inviteCode;
    if (typeof body.claimToken === "string") claimToken = body.claimToken;
  } catch {
    // no body
  }

  try {
    const profile = await ensureProfile(
      user.id,
      user.email,
      user.user_metadata?.full_name,
      inviteCode,
      claimToken
    );
    return NextResponse.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not ensure profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
