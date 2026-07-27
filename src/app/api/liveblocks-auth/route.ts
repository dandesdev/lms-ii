import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import {
  getClassByShareToken,
  canAccessClass,
  getLinkedStudentId,
} from "@/lib/classes";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassRecord } from "@/types/database";

function getLiveblocks() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
  }
  return new Liveblocks({ secret });
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

async function getClassByRoomId(roomId: string): Promise<ClassRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("*, students(id, name)")
    .eq("liveblocks_room_id", roomId)
    .maybeSingle();
  return data as ClassRecord | null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const room = body.room as string | undefined;
  const shareToken = body.shareToken as string | undefined;

  if (!room) {
    return NextResponse.json({ error: "Missing room" }, { status: 400 });
  }

  // Profile + room lookup are independent — run in parallel.
  const [profile, classByRoom] = await Promise.all([
    getProfile(),
    getClassByRoomId(room),
  ]);
  const isTeacher = profile?.role === "teacher";

  // Resolve by liveblocks_room_id (supports class-{uuid}-flat1 epochs).
  // Do NOT parse the class id from the room string — suffixes break that.
  let classRecord = classByRoom;
  if (!classRecord && shareToken) {
    classRecord = await getClassByShareToken(shareToken);
  }

  if (!classRecord || classRecord.liveblocks_room_id !== room) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Teachers never need a linked student row for access checks.
  let studentId: string | null = null;
  if (profile && !isTeacher) {
    studentId = await getLinkedStudentId(profile.id);
  }

  const allowed = await canAccessClass(classRecord, {
    isTeacher,
    studentId,
    viaShareLink: Boolean(shareToken),
  });

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = profile?.id ?? `guest-${shareToken?.slice(0, 8)}`;
  const userName =
    profile?.display_name ?? (shareToken ? "Guest" : "Anonymous");
  const userColor = profile
    ? stringToColor(profile.id)
    : stringToColor(shareToken ?? "guest");

  const liveblocks = getLiveblocks();
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: userName,
      color: userColor,
      role: isTeacher ? "teacher" : "student",
    },
  });

  session.allow(room, session.FULL_ACCESS);
  const { status, body: authBody } = await session.authorize();

  return new NextResponse(authBody, { status });
}
