import { createServiceClient } from "@/lib/supabase/server";
import { getLiveblocksClient } from "@/lib/liveblocks";
import { ensureCollabRoomSeeded } from "@/lib/seed-collab-yjs";

/**
 * Collab schema epochs:
 * - (none) / class-{id}: nested Element separators — corrupted
 * - flat1: flat Decorator separators — no real section wrappers
 * - sec1: section wrappers + early bootstrap — left empty sections/HRs only
 * - sec2: section wrappers; shouldBootstrap false; seed is sole first write
 *
 * Bumping the room id abandons incompatible Yjs history. Next open reseeds
 * from markdown_source into the new empty room (server-side when possible).
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
 * If the class still points at a pre-epoch Liveblocks room, rewrite the room id
 * (service role) and best-effort delete the old room. Seeds only when migrating
 * to a new empty epoch room — not on every page load of an already-canonical
 * room (that Yjs empty-check was a multi-RTT tax). Fresh creates seed via
 * `after()` on POST; `SeedMarkdownPlugin` covers rare misses.
 */
export async function ensureCanonicalCollabRoomId(
  classId: string,
  currentRoomId: string,
  markdownSource?: string | null
): Promise<string> {
  const canonical = canonicalCollabRoomId(classId);
  if (currentRoomId === canonical) {
    return currentRoomId;
  }

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

  if (markdownSource !== undefined) {
    try {
      await ensureCollabRoomSeeded(canonical, markdownSource);
    } catch (err) {
      console.warn("[collab-room] seed after migrate ignored", err);
    }
  }

  return canonical;
}
