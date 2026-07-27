export type UserRole = "superuser" | "teacher" | "student";
export type ClassStatus = "draft" | "published" | "archived";

/** Roles that own students and classes. */
export const TEACHER_ROLES: UserRole[] = ["superuser", "teacher"];

export function isTeacherRole(role: UserRole | null | undefined): boolean {
  return role === "teacher" || role === "superuser";
}

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  email: string | null;
  can_invite_teachers: boolean;
  plan: string;
  invited_by: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  level: string | null;
  email: string | null;
  user_id: string | null;
  owner_id: string;
  created_at: string;
}

export interface ClassRecord {
  id: string;
  student_id: string;
  title: string;
  source_filename: string | null;
  status: ClassStatus;
  share_token: string;
  markdown_source: string | null;
  liveblocks_room_id: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  students?: Pick<Student, "id" | "name">;
}

export interface ClassWithStudent extends ClassRecord {
  students: Pick<Student, "id" | "name">;
}

export interface Plan {
  id: string;
  label: string;
  quota_bytes: number;
  max_students: number | null;
  max_classes: number | null;
  price_cents: number;
  sort_order: number;
}

export interface TeacherInvite {
  id: string;
  code: string;
  email: string | null;
  note: string | null;
  created_by: string;
  can_invite_teachers: boolean;
  plan: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InviteState = "valid" | "expired" | "used" | "revoked" | "unknown";

export interface SubscriptionRecord {
  id: string;
  owner_id: string;
  plan: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: "inactive" | "trialing" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
  grace_until: string | null;
}
