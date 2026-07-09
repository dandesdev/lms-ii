import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function ensureProfile(
  userId: string,
  email: string,
  displayName?: string
): Promise<Profile> {
  const supabase = createServiceClient();
  const teacherEmail = process.env.TEACHER_EMAIL?.toLowerCase();
  const role: UserRole =
    email.toLowerCase() === teacherEmail ? "teacher" : "student";

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      role,
      email,
      display_name: displayName || email.split("@")[0],
    })
    .select("*")
    .single();

  if (error) throw error;

  if (role === "student") {
    await supabase
      .from("students")
      .update({ user_id: userId })
      .eq("email", email);
  }

  return data as Profile;
}

export async function requireTeacher() {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Unauthorized");
  }
  return profile;
}
