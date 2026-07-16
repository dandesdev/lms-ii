import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { getLiveblocksClient } from "@/lib/liveblocks";
import {
  canonicalCollabRoomId,
  ensureCanonicalCollabRoomId,
} from "@/lib/collab-room";

/**
 * Force a clean collab room for this class:
 * migrate to the canonical flat-epoch room id and delete any old room.
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
      .select("id, liveblocks_room_id")
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

    // If already on canonical id, still wipe Yjs by deleting + leaving empty.
    const liveblocks = getLiveblocksClient();
    if (roomId === previousRoomId) {
      await liveblocks.deleteRoom(roomId);
    } else if (roomId !== previousRoomId) {
      // ensureCanonical already deleted previous; also clear canonical if it existed
      try {
        await liveblocks.deleteRoom(roomId);
      } catch {
        // empty / missing is fine
      }
    }

    // Ensure DB points at canonical even after a wipe-only call
    const canonical = canonicalCollabRoomId(classRecord.id);
    if (roomId !== canonical) {
      await ensureCanonicalCollabRoomId(classRecord.id, roomId);
    }

    return NextResponse.json({
      ok: true,
      roomId: canonicalCollabRoomId(classRecord.id),
      previousRoomId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
