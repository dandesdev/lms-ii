export type UserRole = "teacher" | "student";
export type ClassStatus = "draft" | "published" | "archived";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  email: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  level: string | null;
  email: string | null;
  user_id: string | null;
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
  students?: Pick<Student, "id" | "name">;
}

export interface ClassWithStudent extends ClassRecord {
  students: Pick<Student, "id" | "name">;
}
