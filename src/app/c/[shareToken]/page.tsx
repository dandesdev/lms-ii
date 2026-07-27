import Link from "next/link";
import { getClassByShareToken } from "@/lib/classes";
import { ensureCanonicalCollabRoomId } from "@/lib/collab-room";
import { ClassEditorLazy } from "@/components/editor/class-editor-lazy";
import { LinkNotRecognized } from "@/components/link-not-recognized";
import { Button } from "@/components/ui/button";

export default async function ShareClassPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const classRecord = await getClassByShareToken(shareToken);

  if (!classRecord || classRecord.status !== "published") {
    return <LinkNotRecognized />;
  }

  const roomId = await ensureCanonicalCollabRoomId(
    classRecord.id,
    classRecord.liveblocks_room_id,
    classRecord.markdown_source
  );

  return (
    <main className="min-h-screen bg-editor-canvas">
      <ClassEditorLazy
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
