import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/dashboard-snapshot";
import { getClassCountsByStudent } from "@/lib/data/classes";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { RouteLoading } from "@/components/route-loading";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher") {
    redirect("/login");
  }

  return (
    <Suspense
      fallback={
        <RouteLoading
          title="Dashboard"
          statuses={[
            "Opening the board",
            "Loading students",
            "Counting classes",
            "Laying out the page",
          ]}
        />
      }
    >
      <DashboardBody />
    </Suspense>
  );
}

async function DashboardBody() {
  const [snapshot, classCounts] = await Promise.all([
    loadDashboardSnapshot(),
    getClassCountsByStudent(),
  ]);

  return <DashboardClient snapshot={snapshot} classCounts={classCounts} />;
}
