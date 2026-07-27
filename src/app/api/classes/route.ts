import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import {
  extractTitleFromMarkdown,
  filenameToTitle,
} from "@/lib/utils";
import { canonicalCollabRoomId } from "@/lib/collab-room";
import { ensureCollabRoomSeeded } from "@/lib/seed-collab-yjs";
import { revalidateClassData } from "@/lib/data/revalidate-class-data";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const supabase = await createClient();

  try {
    await requireTeacher();
    let query = supabase
      .from("classes")
      .select("*, students(id, name)")
      .order("updated_at", { ascending: false });
    if (studentId) query = query.eq("student_id", studentId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!student) {
      return NextResponse.json({ error: "No student profile" }, { status: 403 });
    }
    const { data, error } = await supabase
      .from("classes")
      .select("*, students(id, name)")
      .eq("student_id", student.id)
      .eq("status", "published")
      .order("updated_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }
}

export async function POST(request: Request) {
  try {
    await requireTeacher();
    const body = await request.json();
    const { studentId, markdown, filename, title: requestedTitle } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const md = typeof markdown === "string" ? markdown : "";
    const fallbackTitle =
      (typeof requestedTitle === "string" && requestedTitle.trim()) ||
      (filename ? filenameToTitle(filename) : "Untitled Class");
    const title = md
      ? extractTitleFromMarkdown(md, fallbackTitle)
      : fallbackTitle;
    const markdownSource = md || `# ${title}\n\n`;
    const classId = randomUUID();
    const roomId = canonicalCollabRoomId(classId);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("classes")
      .insert({
        id: classId,
        student_id: studentId,
        title,
        source_filename: filename || null,
        markdown_source: markdownSource,
        liveblocks_room_id: roomId,
        status: "draft",
      })
      .select("*, students(id, name)")
      .single();

    if (error) throw error;

    revalidateClassData({ studentId, classId });

    // Do not block the create response on Liveblocks. Seed after the response
    // so the client can navigate immediately. Class pages no longer re-probe
    // Yjs when the room id is already canonical; SeedMarkdownPlugin covers
    // the rare race where the editor connects before this finishes.
    after(async () => {
      try {
        await ensureCollabRoomSeeded(roomId, markdownSource);
      } catch (err) {
        console.warn("[classes] seed on create ignored", err);
      }
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
