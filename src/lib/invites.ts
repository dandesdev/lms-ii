import { createServiceClient } from "@/lib/supabase/server";
import type { Profile, TeacherInvite } from "@/types/database";
import { getInviteState } from "@/lib/platform";

export async function getInviteByCode(code: string): Promise<TeacherInvite | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("teacher_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  return data as TeacherInvite | null;
}

export async function validateInviteCode(code: string): Promise<{
  invite: TeacherInvite;
  state: "valid";
} | { state: Exclude<ReturnType<typeof getInviteState>, "valid">; invite: TeacherInvite | null }> {
  const invite = await getInviteByCode(code);
  if (!invite) return { state: "unknown", invite: null };
  const state = getInviteState(invite);
  if (state !== "valid") return { state, invite };
  return { invite, state: "valid" };
}

export async function consumeInvite(
  invite: TeacherInvite,
  profile: Profile
): Promise<void> {
  const supabase = createServiceClient();
  const { error: markErr } = await supabase
    .from("teacher_invites")
    .update({ used_by: profile.id, used_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("used_at", null);
  if (markErr) throw markErr;

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      role: "teacher",
      plan: invite.plan,
      can_invite_teachers: invite.can_invite_teachers,
      invited_by: invite.created_by,
    })
    .eq("id", profile.id);
  if (profileErr) throw profileErr;
}
