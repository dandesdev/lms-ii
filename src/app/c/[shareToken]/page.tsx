import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassByShareToken } from "@/lib/classes";
import { ClassEditor } from "@/components/editor/class-editor";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

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

  const studentName =
    (classRecord.students as { name: string } | null)?.name ?? "Student";

  return (
    <main className="min-h-screen bg-[#fffdf8]">
      <header className="border-b border-[#e0d6c2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-[#1e4d3a]" />
            <div>
              <h1 className="text-lg font-semibold">{classRecord.title}</h1>
              <p className="text-sm text-[#6b6558]">
                Live class with {studentName}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <ClassEditor
        roomId={classRecord.liveblocks_room_id}
        classId={classRecord.id}
        markdownSource={classRecord.markdown_source}
        shareToken={shareToken}
      />
    </main>
  );
}
