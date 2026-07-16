import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { getLiveblocksClient } from "@/lib/liveblocks";
import {
  canonicalCollabRoomId,
  ensureCanonicalCollabRoomId,
} from "@/lib/collab-room";
import { ensureCollabRoomSeeded } from "@/lib/seed-collab-yjs";

/**
 * Force a clean collab room for this class:
 * migrate to the canonical room id, delete Yjs, then reseed from markdown.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireTeacher();
    const { id } = await params;

    const supabase = await createClient();
    const { data: classRecord, error } = await supabase
      .from("classes")
      .select("id, liveblocks_room_id, markdown_source")
      .eq("id", id)
      .maybeSingle();

    if (error || !classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const previousRoomId = classRecord.liveblocks_room_id;
    const roomId = await ensureCanonicalCollabRoomId(
      classRecord.id,
      previousRoomId
    );

    const liveblocks = getLiveblocksClient();
    if (roomId === previousRoomId) {
      await liveblocks.deleteRoom(roomId);
    } else {
      try {
        await liveblocks.deleteRoom(roomId);
      } catch {
        // empty / missing is fine
      }
    }

    const canonical = canonicalCollabRoomId(classRecord.id);
    if (roomId !== canonical) {
      await ensureCanonicalCollabRoomId(classRecord.id, roomId);
    }

    await ensureCollabRoomSeeded(canonical, classRecord.markdown_source);

    return NextResponse.json({
      ok: true,
      roomId: canonical,
      previousRoomId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
