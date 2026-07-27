import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { revalidateClassData } from "@/lib/data/revalidate-class-data";
import type { ClassStatus } from "@/types/database";

const ALLOWED_STATUSES = new Set<ClassStatus>([
  "draft",
  "published",
  "archived",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireTeacher();
    const { id } = await params;
    const body = await request.json();
    const { status, title, started } = body;

    const updates: Record<string, string | null> = {};
    if (typeof status === "string" && ALLOWED_STATUSES.has(status as ClassStatus)) {
      updates.status = status;
    }
    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
    }
    if (started === true) {
      updates.started_at = new Date().toISOString();
    } else if (started === false) {
      updates.started_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("classes")
      .update(updates)
      .eq("id", id)
      .select("*, students(id, name)")
      .single();

    if (error) throw error;

    revalidateClassData({
      studentId: data.student_id,
      classId: id,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireTeacher();
    const { id } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("classes")
      .select("id, student_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) throw error;

    revalidateClassData({
      studentId: existing?.student_id,
      classId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
