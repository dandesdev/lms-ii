// Mirror of the local app's dashboard types (app/src/types.ts).
// The sync command (npm run sync) uploads a DashboardSnapshot built with the
// exact same code the local dashboard uses.

export const SNAPSHOT_BUCKET = "lms-data";
export const SNAPSHOT_FILE = "dashboard.json";

export type ClassStatus = "present" | "absent" | "cancelled" | "no-class";
export type ClassKind = "regular" | "makeup" | "rescheduled" | "experimental";

export interface ClassRef {
  date: string;
  dateLabel: string;
  weekday: string;
  time: string | null;
  timeLabel: string;
  status: ClassStatus;
  kind: ClassKind;
  title: string;
  description: string;
  partialContinuation: boolean;
}

export type ClassFileState = "started" | "fresh";

export interface ClassFile {
  title: string;
  fileName: string;
  state: ClassFileState;
  date: string | null;
}

export interface StudentSummary {
  id: string;
  name: string;
  displayName: string;
  level: string | null;
  startDate: string | null;
  goals: string[] | null;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  cancelledCount: number;
  trialCount: number;
  trialWarning: boolean;
  readyClasses: ClassFile[];
  readyFreshCount: number;
  readyPartialCount: number;
  pastClassFiles: number;
  history: ClassRef[];
}

export interface DashboardPayload {
  generatedAt: string;
  students: StudentSummary[];
  totals: {
    activeStudents: number;
    classesLogged: number;
    presentTotal: number;
    absentTotal: number;
    readyTotal: number;
  };
}

export interface AgendaEvent {
  start: string;
  end: string | null;
  summary: string;
  studentId: string | null;
  studentName: string | null;
  readyCount: number;
  readyPartialCount: number;
  readyFreshCount: number;
  warning: "no-file" | "unknown-student" | null;
}

export interface AgendaPayload {
  configured: boolean;
  error: string | null;
  rangeDays: number;
  keyword: string;
  checkedAt: string;
  events: AgendaEvent[];
  warningCount: number;
}

export interface DashboardSnapshot {
  syncedAt: string;
  dashboard: DashboardPayload;
  agenda: AgendaPayload;
  /** local folder id → LMS students.id */
  lmsStudentIds: Record<string, string>;
}

/** Per-student LMS class counts, computed live from Supabase. */
export interface LmsClassCounts {
  total: number;
  draft: number;
  published: number;
  archived: number;
}
