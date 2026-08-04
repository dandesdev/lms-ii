import { NextResponse } from "next/server";
import { revalidateClassData } from "@/lib/data/revalidate-class-data";
import { requireTeacher } from "@/lib/auth";
import {
  linkStudentByEmail,
  regenerateClaimToken,
  unlinkStudentAccount,
} from "@/lib/claims";
import { createServiceClient } from "@/lib/supabase/server";

async function getOwnedStudent(studentId: string, ownerId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, name, level, email, user_id, owner_id, claim_token, claimed_at, created_at"
    )
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireTeacher();
    const { id } = await params;
    const student = await getOwnedStudent(id, profile.id);
    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let linkedEmail: string | null = null;
    if (student.user_id) {
      const supabase = createServiceClient();
      const { data: linked } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", student.user_id)
        .maybeSingle();
      linkedEmail = linked?.email ?? null;
    }

    return NextResponse.json({ ...student, linked_email: linkedEmail });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireTeacher();
    const { id } = await params;
    const body = await request.json();
    const action = body.action as string | undefined;

    const owned = await getOwnedStudent(id, profile.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let student;
    if (action === "link") {
      const email = typeof body.email === "string" ? body.email : "";
      student = await linkStudentByEmail(id, profile.id, email);
    } else if (action === "unlink") {
      student = await unlinkStudentAccount(id, profile.id);
    } else if (action === "regenerate_claim") {
      student = await regenerateClaimToken(id, profile.id);
    } else if (action === "update_profile") {
      const supabase = createServiceClient();
      const patch: Record<string, string | null> = {};
      if (typeof body.email === "string") {
        patch.email = body.email.trim() ? body.email.trim().toLowerCase() : null;
      }
      if (typeof body.name === "string" && body.name.trim()) {
        patch.name = body.name.trim();
      }
      if (typeof body.level === "string") {
        patch.level = body.level.trim() || null;
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("students")
        .update(patch)
        .eq("id", id)
        .eq("owner_id", profile.id)
        .select("*")
        .single();
      if (error) throw error;
      student = data;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    revalidateClassData({ studentId: id });

    let linkedEmail: string | null = null;
    if (student.user_id) {
      const supabase = createServiceClient();
      const { data: linked } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", student.user_id)
        .maybeSingle();
      linkedEmail = linked?.email ?? null;
    }

    return NextResponse.json({ ...student, linked_email: linkedEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
