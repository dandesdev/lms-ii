import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getStudentClasses, getStudentSummary } from "@/lib/data/classes";
import { StudentClassesPanel } from "@/components/student-classes-panel";
import { RouteLoading } from "@/components/route-loading";

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

  return (
    <main className="min-h-screen bg-[#f5f0e6]">
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
        <StudentDetailBody studentId={id} />
      </Suspense>
    </main>
  );
}

async function StudentDetailBody({ studentId }: { studentId: string }) {
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
      initialClasses={classes}
    />
  );
}
