import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isTeacherRole } from "@/types/database";
import { getStudentClasses, getStudentSummary } from "@/lib/data/classes";
import { createClient } from "@/lib/supabase/server";
import { StudentClassesPanel } from "@/components/student-classes-panel";
import { RouteLoading } from "@/components/route-loading";
import { SessionEmailFooter } from "@/components/session-email-footer";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile || !isTeacherRole(profile.role)) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f0e6]">
      <div className="flex-1">
        <Suspense
          fallback={
            <RouteLoading
              title="Your classes"
              statuses={[
                "Opening the folder",
                "Gathering classes",
                "Sorting the list",
                "Laying out the page",
              ]}
            />
          }
        >
          <StudentDetailBody studentId={id} ownerId={profile.id} />
        </Suspense>
      </div>
      <SessionEmailFooter email={profile.email} />
    </main>
  );
}

async function StudentDetailBody({
  studentId,
  ownerId,
}: {
  studentId: string;
  ownerId: string;
}) {
  // RLS already scopes teachers to their own rows; service-role loaders skip RLS.
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!owned) notFound();

  // Defense in depth: confirm tenant match when owner_id is readable.
  const { data: tenant } = await supabase
    .from("students")
    .select("owner_id")
    .eq("id", studentId)
    .maybeSingle();
  if (tenant?.owner_id && tenant.owner_id !== ownerId) notFound();

  const [student, classes] = await Promise.all([
    getStudentSummary(studentId),
    getStudentClasses(studentId),
  ]);

  if (!student) notFound();

  return (
    <StudentClassesPanel
      studentId={student.id}
      studentName={student.name}
      studentLevel={student.level}
      studentEmail={student.email}
      claimToken={student.claim_token}
      userId={student.user_id}
      linkedEmail={student.linked_email}
      claimedAt={student.claimed_at}
      initialClasses={classes}
    />
  );
}
