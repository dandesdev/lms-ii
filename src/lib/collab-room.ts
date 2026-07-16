import { createServiceClient } from "@/lib/supabase/server";
import { getLiveblocksClient } from "@/lib/liveblocks";

/**
 * Collab schema epochs:
 * - (none) / class-{id}: nested Element separators — corrupted
 * - flat1: flat Decorator separators — no real section wrappers
 * - sec1: section wrappers + early bootstrap — left empty sections/HRs only
 * - sec2: section wrappers; shouldBootstrap false; seed is sole first write
 *
 * Bumping the room id abandons incompatible Yjs history. Next open reseeds
 * from markdown_source into the new empty room.
 */
export const COLLAB_ROOM_EPOCH = "sec2";

export function canonicalCollabRoomId(classId: string): string {
  return `class-${classId}-${COLLAB_ROOM_EPOCH}`;
}

export function isCanonicalCollabRoomId(
  roomId: string,
  classId: string
): boolean {
  return roomId === canonicalCollabRoomId(classId);
}

/**
 * If the class still points at a pre-flat Liveblocks room, rewrite the room id
 * (service role) and best-effort delete the old room.
 */
export async function ensureCanonicalCollabRoomId(
  classId: string,
  currentRoomId: string
): Promise<string> {
  const canonical = canonicalCollabRoomId(classId);
  if (currentRoomId === canonical) return currentRoomId;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("classes")
    .update({ liveblocks_room_id: canonical })
    .eq("id", classId);

  if (error) {
    console.error("[collab-room] failed to migrate room id", error);
    return currentRoomId;
  }

  try {
    const liveblocks = getLiveblocksClient();
    await liveblocks.deleteRoom(currentRoomId);
  } catch (err) {
    console.warn("[collab-room] deleteRoom ignored", err);
  }

  console.warn(
    `[collab-room] migrated ${classId}: ${currentRoomId} → ${canonical}`
  );
  return canonical;
}
