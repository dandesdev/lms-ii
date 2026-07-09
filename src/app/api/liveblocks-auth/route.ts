import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import {
  getClassById,
  getClassByShareToken,
  canAccessClass,
  getLinkedStudentId,
} from "@/lib/classes";
import { getProfile } from "@/lib/auth";

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

export async function POST(request: Request) {
  const body = await request.json();
  const room = body.room as string | undefined;
  const shareToken = body.shareToken as string | undefined;

  if (!room) {
    return NextResponse.json({ error: "Missing room" }, { status: 400 });
  }

  const profile = await getProfile();
  const isTeacher = profile?.role === "teacher";

  let classRecord = await getClassById(room.replace("class-", ""));
  if (!classRecord && shareToken) {
    classRecord = await getClassByShareToken(shareToken);
  }

  if (!classRecord || classRecord.liveblocks_room_id !== room) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  let studentId: string | null = null;
  if (profile) {
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
