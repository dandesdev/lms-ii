import { NextResponse } from "next/server";
import { requireSuperuser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireSuperuser();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, plan, can_invite_teachers, created_at")
      .in("role", ["teacher", "superuser"])
      .order("created_at");
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperuser();
    const body = await request.json();
    const { teacherId, can_invite_teachers, plan } = body;
    if (!teacherId) {
      return NextResponse.json({ error: "teacherId required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (typeof can_invite_teachers === "boolean") {
      patch.can_invite_teachers = can_invite_teachers;
    }
    if (typeof plan === "string") patch.plan = plan;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", teacherId)
      .neq("role", "superuser")
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
