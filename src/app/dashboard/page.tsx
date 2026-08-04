import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/dashboard-snapshot";
import { getClassCountsByStudent } from "@/lib/data/classes";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { RouteLoading } from "@/components/route-loading";
import { SessionEmailFooter } from "@/components/session-email-footer";
import { isTeacherRole } from "@/types/database";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile || !isTeacherRole(profile.role)) {
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
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const [snapshot, classCounts] = await Promise.all([
    loadDashboardSnapshot(profile.id),
    getClassCountsByStudent(profile.id),
  ]);

  return (
    <>
      <DashboardClient
        snapshot={snapshot}
        classCounts={classCounts}
        isSuperuser={profile.role === "superuser"}
      />
      <SessionEmailFooter email={profile.email} />
    </>
  );
}
