import type { InviteState, Profile, UserRole } from "@/types/database";
import { isTeacherRole } from "@/types/database";

export function resolveBootstrapRole(email: string): UserRole {
  const superuserEmail = process.env.SUPERUSER_EMAIL?.toLowerCase();
  const legacyTeacher = process.env.TEACHER_EMAIL?.toLowerCase();
  const lower = email.toLowerCase();
  if (superuserEmail && lower === superuserEmail) return "superuser";
  if (legacyTeacher && lower === legacyTeacher) return "teacher";
  return "student";
}

export function getInviteState(invite: {
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InviteState {
  if (invite.revoked_at) return "revoked";
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  return "valid";
}

export function canCreateInvites(profile: Profile): boolean {
  if (profile.role === "superuser") return true;
  return isTeacherRole(profile.role) && profile.can_invite_teachers;
}

export function snapshotPathForOwner(ownerId: string): string {
  return `${ownerId}/dashboard.json`;
}

export function agendaConfigPathForOwner(ownerId: string): string {
  return `${ownerId}/agenda-config.json`;
}
