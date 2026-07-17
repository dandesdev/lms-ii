import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ensureCanonicalCollabRoomId } from "@/lib/collab-room";
import { ClassEditor } from "@/components/editor/class-editor";
import { PublishControls } from "@/components/publish-controls";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [profile, { data: classRecord }] = await Promise.all([
    getProfile(),
    supabase
      .from("classes")
      .select("id, student_id, title, status, share_token, markdown_source, liveblocks_room_id")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!profile) {
    redirect(`/login?next=/class/${id}`);
  }

  if (!classRecord) notFound();

  const isTeacher = profile.role === "teacher";

  if (!isTeacher) {
    if (classRecord.status !== "published") {
      redirect("/student");
    }
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!student || student.id !== classRecord.student_id) {
      redirect("/student");
    }
  }

  const roomId = await ensureCanonicalCollabRoomId(
    classRecord.id,
    classRecord.liveblocks_room_id,
    classRecord.markdown_source
  );

  return (
    <main className="min-h-screen bg-editor-canvas">
      <ClassEditor
        roomId={roomId}
        classId={classRecord.id}
        markdownSource={classRecord.markdown_source}
        backHref={isTeacher ? `/dashboard/students/${classRecord.student_id}` : "/student"}
        enableMarkUpMode={isTeacher}
        toolbarRight={
          isTeacher ? (
            <PublishControls
              classId={classRecord.id}
              status={classRecord.status}
              shareToken={classRecord.share_token}
            />
          ) : undefined
        }
      />
    </main>
  );
}
