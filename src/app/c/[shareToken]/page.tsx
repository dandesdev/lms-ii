import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassByShareToken } from "@/lib/classes";
import { ensureCanonicalCollabRoomId } from "@/lib/collab-room";
import { ClassEditor } from "@/components/editor/class-editor";
import { Button } from "@/components/ui/button";

export default async function ShareClassPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const classRecord = await getClassByShareToken(shareToken);

  if (!classRecord || classRecord.status !== "published") {
    notFound();
  }

  const roomId = await ensureCanonicalCollabRoomId(
    classRecord.id,
    classRecord.liveblocks_room_id
  );

  return (
    <main className="min-h-screen bg-[#fffdf8]">
      <ClassEditor
        roomId={roomId}
        classId={classRecord.id}
        markdownSource={classRecord.markdown_source}
        shareToken={shareToken}
        toolbarRight={
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
    </main>
  );
}
