import { NextResponse } from "next/server";
import { requireTeacher, requireSuperuser } from "@/lib/auth";
import { canCreateInvites } from "@/lib/platform";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const profile = await requireTeacher();
    if (!canCreateInvites(profile)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teacher_invites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireTeacher();
    if (!canCreateInvites(profile)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : null;
    const note = typeof body.note === "string" ? body.note.trim() : null;
    const canInvite =
      profile.role === "superuser" ? Boolean(body.can_invite_teachers) : false;
    const plan = typeof body.plan === "string" ? body.plan : "free";
    const days = Number(body.expiresInDays ?? 30);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teacher_invites")
      .insert({
        email,
        note,
        created_by: profile.id,
        can_invite_teachers: canInvite,
        plan,
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperuser();
    const body = await request.json();
    const { inviteId, revoked } = body;
    if (!inviteId) {
      return NextResponse.json({ error: "inviteId required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teacher_invites")
      .update({
        revoked_at: revoked ? new Date().toISOString() : null,
      })
      .eq("id", inviteId)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
