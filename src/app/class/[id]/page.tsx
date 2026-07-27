import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ensureCanonicalCollabRoomId } from "@/lib/collab-room";
import { getClassPageRecord } from "@/lib/data/classes";
import { ClassEditorLazy } from "@/components/editor/class-editor-lazy";
import { ClassOpenBootBridge } from "@/components/editor/class-open-boot-bridge";
import { LinkNotRecognized } from "@/components/link-not-recognized";
import { PublishControls } from "@/components/publish-controls";
import { ClassOpeningLoading } from "@/components/class-opening-loading";
import type { Profile } from "@/types/database";
import { isTeacherRole } from "@/types/database";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();

  if (!profile) {
    redirect(`/login?next=/class/${id}`);
  }

  return (
    <Suspense fallback={<ClassOpeningLoading />}>
      <ClassPageBody classId={id} profile={profile} />
    </Suspense>
  );
}

async function ClassPageBody({
  classId,
  profile,
}: {
  classId: string;
  profile: Profile;
}) {
  const isTeacher = isTeacherRole(profile.role);
  const classRecord = await getClassPageRecord(classId);

  if (!classRecord) {
    if (isTeacher) notFound();
    return <LinkNotRecognized />;
  }

  if (!isTeacher) {
    if (classRecord.status !== "published") {
      redirect("/student");
    }
    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!student || student.id !== classRecord.student_id) {
      return <LinkNotRecognized />;
    }
  }

  const roomId = await ensureCanonicalCollabRoomId(
    classRecord.id,
    classRecord.liveblocks_room_id,
    classRecord.markdown_source
  );

  return (
    <main className="min-h-screen bg-editor-canvas">
      <ClassOpenBootBridge />
      <ClassEditorLazy
        roomId={roomId}
        classId={classRecord.id}
        markdownSource={classRecord.markdown_source}
        backHref={
          isTeacher
            ? `/dashboard/students/${classRecord.student_id}`
            : "/student"
        }
        enableMarkUpMode={isTeacher}
        toolbarRight={
          isTeacher ? (
            <PublishControls
              classId={classRecord.id}
              status={classRecord.status}
              shareToken={classRecord.share_token}
              startedAt={classRecord.started_at}
            />
          ) : undefined
        }
      />
    </main>
  );
}
