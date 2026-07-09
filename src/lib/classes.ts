import { createClient } from "@/lib/supabase/server";
import type { ClassRecord } from "@/types/database";

export async function getClassById(id: string): Promise<ClassRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("*, students(id, name)")
    .eq("id", id)
    .maybeSingle();
  return data as ClassRecord | null;
}

export async function getClassByShareToken(
  token: string
): Promise<ClassRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("*, students(id, name)")
    .eq("share_token", token)
    .maybeSingle();
  return data as ClassRecord | null;
}

export async function canAccessClass(
  classRecord: ClassRecord,
  options: {
    isTeacher: boolean;
    studentId?: string | null;
    viaShareLink?: boolean;
  }
): Promise<boolean> {
  if (options.isTeacher) return true;

  if (classRecord.status !== "published") {
    return false;
  }

  if (options.viaShareLink) return true;

  if (options.studentId && classRecord.student_id === options.studentId) {
    return true;
  }

  return false;
}

export async function getLinkedStudentId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
