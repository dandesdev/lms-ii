import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ClassEditor } from "@/components/editor/class-editor";
import { PublishControls } from "@/components/publish-controls";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

  const supabase = await createClient();
  const { data: classRecord } = await supabase
    .from("classes")
    .select("*, students(id, name)")
    .eq("id", id)
    .maybeSingle();

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

  const studentName =
    (classRecord.students as { name: string } | null)?.name ?? "Student";

  return (
    <main className="min-h-screen bg-[#fffdf8]">
      <header className="border-b border-[#e0d6c2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={isTeacher ? `/dashboard/students/${classRecord.student_id}` : "/student"}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{classRecord.title}</h1>
              <p className="text-sm text-[#6b6558]">{studentName}</p>
            </div>
          </div>
          {isTeacher && (
            <PublishControls
              classId={classRecord.id}
              status={classRecord.status}
              shareToken={classRecord.share_token}
            />
          )}
        </div>
      </header>

      <ClassEditor
        roomId={classRecord.liveblocks_room_id}
        classId={classRecord.id}
        markdownSource={classRecord.markdown_source}
      />
    </main>
  );
}
