import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, LogOut } from "lucide-react";

export default async function StudentPortalPage() {
  const profile = await getProfile();
  if (!profile) {
    redirect("/login?next=/student");
  }

  if (profile.role === "teacher") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("user_id", profile.id)
    .maybeSingle();

  let classes: Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
  }> = [];

  if (student) {
    const { data } = await supabase
      .from("classes")
      .select("id, title, status, updated_at")
      .eq("student_id", student.id)
      .eq("status", "published")
      .order("updated_at", { ascending: false });
    classes = data ?? [];
  }

  return (
    <main className="min-h-screen bg-[#f5f0e6]">
      <header className="border-b border-[#e0d6c2] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-[#1e4d3a]" />
            <div>
              <h1 className="text-xl font-semibold text-[#1e4d3a]">My Classes</h1>
              <p className="text-sm text-[#6b6558]">
                {student?.name ?? profile.display_name}
              </p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Published classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!student && (
              <p className="py-6 text-center text-[#6b6558]">
                Your account is not linked to a student profile yet. Ask your
                teacher to add your email when creating your profile.
              </p>
            )}
            {student && classes.length === 0 && (
              <p className="py-6 text-center text-[#6b6558]">
                No published classes yet. Your teacher will publish them when ready.
              </p>
            )}
            <div className="divide-y divide-[#e8e0d0]">
              {classes.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/class/${cls.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-[#faf7f0] -mx-2 px-2 rounded-md"
                >
                  <p className="font-medium">{cls.title}</p>
                  <Badge variant="success">published</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
