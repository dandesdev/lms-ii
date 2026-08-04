import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { EditorTheme } from "@/lib/editor-theme";
import type { ClassStatus } from "@/types/database";
import type { LmsClassCounts } from "@/types/dashboard";

export type StudentListClass = {
  id: string;
  title: string;
  source_filename: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
};

export type ClassPageRecord = {
  id: string;
  student_id: string;
  title: string;
  status: ClassStatus;
  share_token: string;
  markdown_source: string | null;
  liveblocks_room_id: string;
  started_at: string | null;
  editor_theme: EditorTheme | null;
};

export type StudentSummaryRow = {
  id: string;
  name: string;
  level: string | null;
  email: string | null;
  user_id: string | null;
  claim_token: string;
  claimed_at: string | null;
  linked_email: string | null;
};

/** Cache tags — keep in sync with revalidateTag calls in API routes. */
export const tags = {
  studentClasses: (studentId: string) => `student-classes:${studentId}`,
  studentClassesAll: "student-classes",
  classRecord: (classId: string) => `class:${classId}`,
  classCounts: "class-counts",
  student: (studentId: string) => `student:${studentId}`,
} as const;

/**
 * Cached loaders use the service role so they never touch request cookies
 * (required for `use cache`). Callers must authorize before invoking.
 */
export async function getStudentSummary(
  studentId: string
): Promise<StudentSummaryRow | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.student(studentId));

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, name, level, email, user_id, claim_token, claimed_at")
    .eq("id", studentId)
    .maybeSingle();

  // Before migration 20260731_student_claim_tokens.sql the claim columns are
  // missing — fall back so the student page still loads.
  if (error) {
    const { data: basic } = await supabase
      .from("students")
      .select("id, name, level, email, user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (!basic) return null;

    let linked_email: string | null = null;
    if (basic.user_id) {
      const { data: linked } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", basic.user_id)
        .maybeSingle();
      linked_email = linked?.email ?? null;
    }

    return {
      ...basic,
      claim_token: "",
      claimed_at: null,
      linked_email,
    };
  }

  if (!data) return null;

  let linked_email: string | null = null;
  if (data.user_id) {
    const { data: linked } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.user_id)
      .maybeSingle();
    linked_email = linked?.email ?? null;
  }

  return { ...data, linked_email };
}

export async function getStudentClasses(
  studentId: string
): Promise<StudentListClass[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.studentClasses(studentId));
  cacheTag(tags.studentClassesAll);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, title, source_filename, status, created_at, updated_at, started_at"
    )
    .eq("student_id", studentId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentListClass[];
}

export async function getPublishedStudentClasses(
  studentId: string
): Promise<StudentListClass[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.studentClasses(studentId));
  cacheTag(tags.studentClassesAll);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, title, source_filename, status, created_at, updated_at, started_at"
    )
    .eq("student_id", studentId)
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentListClass[];
}

export async function getClassPageRecord(
  classId: string
): Promise<ClassPageRecord | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.classRecord(classId));

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, student_id, title, status, share_token, markdown_source, liveblocks_room_id, started_at, editor_theme"
    )
    .eq("id", classId)
    .maybeSingle();

  // Before migration 20260804_class_editor_theme.sql the column is missing.
  if (error) {
    const { data: basic } = await supabase
      .from("classes")
      .select(
        "id, student_id, title, status, share_token, markdown_source, liveblocks_room_id, started_at"
      )
      .eq("id", classId)
      .maybeSingle();
    if (!basic) return null;
    return { ...basic, editor_theme: null };
  }

  return data as ClassPageRecord | null;
}

export async function getClassCountsByStudent(
  ownerId?: string
): Promise<Record<string, LmsClassCounts>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.classCounts);
  if (ownerId) cacheTag(`class-counts:${ownerId}`);

  const supabase = createServiceClient();
  let query = supabase.from("classes").select("student_id, status, students(owner_id)");
  if (ownerId) {
    query = query.eq("students.owner_id", ownerId);
  }
  const { data, error } = await query;
  if (error) throw error;

  const classCounts: Record<string, LmsClassCounts> = {};
  for (const cls of data ?? []) {
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
  return classCounts;
}
