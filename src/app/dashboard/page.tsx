import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/dashboard-snapshot";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { LmsClassCounts } from "@/types/dashboard";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher") {
    redirect("/login");
  }

  const supabase = await createClient();
  const [snapshot, { data: classes }] = await Promise.all([
    loadDashboardSnapshot(),
    supabase.from("classes").select("student_id, status"),
  ]);

  const classCounts: Record<string, LmsClassCounts> = {};
  for (const cls of classes ?? []) {
    const entry = (classCounts[cls.student_id] ??= {
      total: 0,
      draft: 0,
      published: 0,
      archived: 0,
    });
    entry.total++;
    if (cls.status === "draft") entry.draft++;
    else if (cls.status === "published") entry.published++;
    else if (cls.status === "archived") entry.archived++;
  }

  return <DashboardClient snapshot={snapshot} classCounts={classCounts} />;
}
