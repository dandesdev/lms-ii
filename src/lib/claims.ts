import { createServiceClient } from "@/lib/supabase/server";
import type { Student } from "@/types/database";

export type ClaimValidation =
  | {
      valid: true;
      studentName: string;
      alreadyClaimed: boolean;
    }
  | { valid: false; reason: "unknown" };

export async function getStudentByClaimToken(
  token: string
): Promise<Student | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("claim_token", token)
    .maybeSingle();
  return data as Student | null;
}

export async function validateClaimToken(
  token: string
): Promise<ClaimValidation> {
  const student = await getStudentByClaimToken(token);
  if (!student) return { valid: false, reason: "unknown" };
  return {
    valid: true,
    studentName: student.name,
    alreadyClaimed: Boolean(student.user_id),
  };
}

async function getLinkedStudentForUser(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Bind an auth user to the student row identified by claim_token.
 * Idempotent when the same user already owns the row.
 */
export async function claimStudentForUser(
  token: string,
  userId: string,
  authEmail?: string | null
): Promise<{ student: Student }> {
  const supabase = createServiceClient();
  const student = await getStudentByClaimToken(token);
  if (!student) {
    throw new Error("Claim link is not valid.");
  }

  if (student.user_id && student.user_id !== userId) {
    throw new Error(
      "This student is already linked to another account. Ask your teacher to unlink it first."
    );
  }

  const existingLink = await getLinkedStudentForUser(userId);
  if (existingLink && existingLink.id !== student.id) {
    throw new Error(
      "This account is already linked to a different student profile."
    );
  }

  if (student.user_id === userId) {
    return { student };
  }

  const patch: Record<string, string | null> = {
    user_id: userId,
    claimed_at: new Date().toISOString(),
  };
  // Fill contact email only when the teacher left it blank.
  if (!student.email && authEmail) {
    patch.email = authEmail.trim().toLowerCase();
  }

  const { data, error } = await supabase
    .from("students")
    .update(patch)
    .eq("id", student.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  // Race: another claim won between read and update.
  if (!data) {
    const again = await getStudentByClaimToken(token);
    if (again?.user_id === userId) return { student: again };
    throw new Error(
      "This student is already linked to another account. Ask your teacher to unlink it first."
    );
  }

  return { student: data as Student };
}

function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Teacher recovery: bind a student row to an existing student-role account
 * found by login email.
 */
export async function linkStudentByEmail(
  studentId: string,
  ownerId: string,
  email: string
): Promise<Student> {
  const supabase = createServiceClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required.");

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (studentErr) throw studentErr;
  if (!student) throw new Error("Student not found.");
  if (student.user_id) {
    throw new Error("This student is already linked. Unlink first.");
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, email")
    .ilike("email", escapeIlikeExact(normalized))
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (!profile) {
    throw new Error(
      "No account found with that email. Ask the student to sign up via the claim link first."
    );
  }
  if (profile.role !== "student") {
    throw new Error("That email belongs to a teacher account, not a student.");
  }

  const existingLink = await getLinkedStudentForUser(profile.id);
  if (existingLink) {
    throw new Error(
      "That account is already linked to another student profile."
    );
  }

  const { data, error } = await supabase
    .from("students")
    .update({
      user_id: profile.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .is("user_id", null)
    .select("*")
    .single();

  if (error) throw error;
  return data as Student;
}

export async function unlinkStudentAccount(
  studentId: string,
  ownerId: string
): Promise<Student> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("students")
    .update({ user_id: null, claimed_at: null })
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Student;
}

function randomClaimToken(): string {
  // 32 hex chars — same shape as encode(gen_random_bytes(16), 'hex')
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function regenerateClaimToken(
  studentId: string,
  ownerId: string
): Promise<Student> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("students")
    .update({ claim_token: randomClaimToken() })
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Student;
}
