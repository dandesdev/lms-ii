import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ImportMarkdownButton } from "@/components/import-markdown-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen } from "lucide-react";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher") {
    redirect("/login");
  }

  const { id } = await params;
  const supabase = await createClient();

  // Fetch in parallel and skip heavy columns (markdown_source can be huge).
  const [{ data: student }, { data: classes }] = await Promise.all([
    supabase.from("students").select("id, name, level").eq("id", id).maybeSingle(),
    supabase
      .from("classes")
      .select("id, title, source_filename, status, updated_at")
      .eq("student_id", id)
      .order("updated_at", { ascending: false }),
  ]);

  if (!student) notFound();

  return (
    <main className="min-h-screen bg-[#f5f0e6]">
      <header className="border-b border-[#e0d6c2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{student.name}</h1>
              {student.level && (
                <p className="text-sm text-[#6b6558]">{student.level}</p>
              )}
            </div>
          </div>
          <ImportMarkdownButton studentId={student.id} />
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#e8e0d0]">
              {classes?.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/class/${cls.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-[#faf7f0] -mx-2 px-2 rounded-md"
                >
                  <div>
                    <p className="font-medium">{cls.title}</p>
                    {cls.source_filename && (
                      <p className="text-xs text-[#8a8272]">{cls.source_filename}</p>
                    )}
                  </div>
                  <Badge
                    variant={cls.status === "published" ? "success" : "warning"}
                  >
                    {cls.status}
                  </Badge>
                </Link>
              ))}
              {(!classes || classes.length === 0) && (
                <p className="py-6 text-center text-[#6b6558]">
                  No classes yet. Import a markdown file to create one.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
