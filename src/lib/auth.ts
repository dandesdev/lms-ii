import { cache } from "react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { claimStudentForUser } from "@/lib/claims";
import { consumeInvite, getInviteByCode } from "@/lib/invites";
import type { Profile, UserRole } from "@/types/database";
import { isTeacherRole } from "@/types/database";
import { resolveBootstrapRole } from "@/lib/platform";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
});

async function applyStudentClaim(
  profile: Profile,
  claimToken: string | null | undefined,
  email: string
): Promise<void> {
  if (!claimToken) return;
  if (isTeacherRole(profile.role)) {
    throw new Error("Teacher accounts cannot claim a student profile.");
  }
  await claimStudentForUser(claimToken, profile.id, email);
}

export async function ensureProfile(
  userId: string,
  email: string,
  displayName?: string,
  inviteCode?: string | null,
  claimToken?: string | null
): Promise<Profile> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    const profile = existing as Profile;
    await applyStudentClaim(profile, claimToken, email);
    return profile;
  }

  let role: UserRole = resolveBootstrapRole(email);
  let plan = role === "superuser" ? "free" : "free";
  let canInvite = role === "superuser";
  let invitedBy: string | null = null;
  let invite: Awaited<ReturnType<typeof getInviteByCode>> = null;

  // Teacher invite wins over student claim when both are somehow present.
  if (role !== "superuser" && inviteCode) {
    invite = await getInviteByCode(inviteCode);
    if (invite && !invite.used_at && !invite.revoked_at) {
      role = "teacher";
      plan = invite.plan;
      canInvite = invite.can_invite_teachers;
      invitedBy = invite.created_by;
    }
  }

  // Without a claim token, new student profiles stay unlinked until the
  // student opens a claim link or the teacher links them from the dashboard.

  const insertPayload: Record<string, unknown> = {
    id: userId,
    role,
    email,
    display_name: displayName || email.split("@")[0],
    plan,
    can_invite_teachers: canInvite,
    invited_by: invitedBy,
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;

  const profile = data as Profile;

  if (invite && role === "teacher") {
    await consumeInvite(invite, profile);
    const { data: refreshed } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (refreshed) return refreshed as Profile;
  }

  if (role === "student") {
    await applyStudentClaim(profile, claimToken, email);
  }

  return profile;
}

export async function requireTeacher(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isTeacherRole(profile.role)) {
    throw new Error("Unauthorized");
  }
  return profile;
}

export async function requireSuperuser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || profile.role !== "superuser") {
    throw new Error("Unauthorized");
  }
  return profile;
}
