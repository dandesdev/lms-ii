import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { AddStudentForm } from "@/components/add-student-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher") {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("*, classes(id, status)")
    .order("name");

  const { data: allClasses } = await supabase
    .from("classes")
    .select("id, status");

  const publishedCount =
    allClasses?.filter((c) => c.status === "published").length ?? 0;
  const draftCount = allClasses?.filter((c) => c.status === "draft").length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f0e6]">
      <header className="border-b border-[#e0d6c2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-[#1e4d3a]" />
            <h1 className="text-xl font-semibold text-[#1e4d3a]">Teacher Dashboard</h1>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-[#1e4d3a]" />
              <div>
                <p className="text-2xl font-semibold">{students?.length ?? 0}</p>
                <p className="text-xs uppercase tracking-wide text-[#6b6558]">Students</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-[#1e4d3a]" />
              <div>
                <p className="text-2xl font-semibold">{publishedCount}</p>
                <p className="text-xs uppercase tracking-wide text-[#6b6558]">Published</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-[#856404]" />
              <div>
                <p className="text-2xl font-semibold">{draftCount}</p>
                <p className="text-xs uppercase tracking-wide text-[#6b6558]">Drafts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <AddStudentForm />

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#e8e0d0]">
              {students?.map((student) => {
                const classCount = student.classes?.length ?? 0;
                const published =
                  student.classes?.filter(
                    (c: { status: string }) => c.status === "published"
                  ).length ?? 0;
                return (
                  <Link
                    key={student.id}
                    href={`/dashboard/students/${student.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-[#faf7f0] -mx-2 px-2 rounded-md"
                  >
                    <div>
                      <p className="font-medium">{student.name}</p>
                      {student.level && (
                        <p className="text-sm text-[#6b6558]">{student.level}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="muted">{classCount} classes</Badge>
                      {published > 0 && (
                        <Badge variant="success">{published} published</Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
              {(!students || students.length === 0) && (
                <p className="py-6 text-center text-[#6b6558]">
                  No students yet. Add one above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
