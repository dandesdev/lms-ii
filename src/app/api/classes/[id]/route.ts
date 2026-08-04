import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { revalidateClassData } from "@/lib/data/revalidate-class-data";
import type { ClassStatus } from "@/types/database";
import { recordUsageSnapshot } from "@/lib/usage/meter";
import { parseEditorTheme } from "@/lib/editor-theme";

const IMAGES_BUCKET = "class-images";

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
    const { status, title, started, editor_theme } = body;

    const updates: Record<string, string | null | object> = {};
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
    if (editor_theme !== undefined) {
      const parsed = parseEditorTheme(editor_theme);
      updates.editor_theme = parsed ?? {};
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
    const profile = await requireTeacher();
    const { id } = await params;
    const supabase = await createClient();
    const service = createServiceClient();

    const { data: existing } = await supabase
      .from("classes")
      .select("id, student_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) throw error;

    const { data: objects } = await service.storage.from(IMAGES_BUCKET).list(id);
    if (objects?.length) {
      const paths = objects.map((o) => `${id}/${o.name}`);
      await service.storage.from(IMAGES_BUCKET).remove(paths);
    }
  const ownerPrefix = `${profile.id}/${id}`;
  const { data: ownerObjects } = await service.storage.from(IMAGES_BUCKET).list(`${profile.id}/${id}`);
  if (ownerObjects?.length) {
    const paths = ownerObjects.map((o) => `${ownerPrefix}/${o.name}`);
    await service.storage.from(IMAGES_BUCKET).remove(paths);
  }

    await recordUsageSnapshot(profile.id);

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
