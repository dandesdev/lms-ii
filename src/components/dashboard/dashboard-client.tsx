"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  BookOpenCheck,
  GraduationCap,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { ClassSummaryDialog } from "@/components/dashboard/class-summary-dialog";
import { HistoryClassBadge, ReadyCountBadge } from "@/components/dashboard/class-badge";
import { ClassDetailDialog, type SelectedClass } from "@/components/dashboard/class-detail-dialog";
import { StudentDialog } from "@/components/dashboard/student-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ROW_UPCOMING_DANGER } from "@/lib/class-visuals";
import type {
  DashboardSnapshot,
  LmsClassCounts,
  StudentSummary,
} from "@/types/dashboard";

const RECENT_COUNT = 3;

/** Deterministic dd/mm/yyyy HH:MM so server and client render the same HTML. */
function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StatBlock({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <Card className="min-w-[150px] flex-1">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="font-display text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceBar({
  present,
  total,
  onClick,
}: {
  present: number;
  total: number;
  onClick: () => void;
}) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Open student profile"
      className="w-28 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent/60"
    >
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="font-semibold text-[#1e4d3a]">{present} present</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e6ddc8]">
        <div
          className="h-full rounded-full bg-[#1e4d3a] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

/** Extra LMS column — opens the student's class list to edit/publish. */
function LmsClassesCell({
  lmsStudentId,
  counts,
}: {
  lmsStudentId: string | null;
  counts: LmsClassCounts | null;
}) {
  if (!lmsStudentId) {
    return (
      <span
        className="font-mono text-[11px] text-muted-foreground"
        title="Not synced to the LMS yet — run npm run sync"
      >
        —
      </span>
    );
  }
  const total = counts?.total ?? 0;
  const published = counts?.published ?? 0;
  return (
    <Link
      href={`/dashboard/students/${lmsStudentId}`}
      onClick={(e) => e.stopPropagation()}
      title={`Open the ${total} LMS classes to edit/publish (${published} published)`}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#1e4d3a]/25 bg-[#e6f0e8] px-2 py-1 font-mono text-[11px] leading-tight text-[#1e4d3a] transition-colors hover:bg-[#d5e6d9]"
    >
      <BookOpen className="h-3 w-3 shrink-0" />
      <span className="font-semibold">{total}</span>
      {published > 0 && <span className="opacity-70">{published} pub</span>}
    </Link>
  );
}

export function DashboardClient({
  snapshot,
  classCounts,
}: {
  snapshot: DashboardSnapshot | null;
  classCounts: Record<string, LmsClassCounts>;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(null);
  const [openStudent, setOpenStudent] = useState<StudentSummary | null>(null);
  const [summaryStudent, setSummaryStudent] = useState<StudentSummary | null>(null);

  const data = snapshot?.dashboard ?? null;
  const agenda = snapshot?.agenda ?? null;

  const students = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q),
    );
  }, [data, query]);

  const upcomingNoFileIds = useMemo(() => {
    const ids = new Set<string>();
    if (!agenda?.events) return ids;
    for (const e of agenda.events) {
      if (e.warning === "no-file" && e.studentId) ids.add(e.studentId);
    }
    return ids;
  }, [agenda]);

  if (!snapshot || !data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">No dashboard data yet</h1>
        <p className="mt-2 text-muted-foreground">
          Run <span className="font-mono text-foreground">npm run sync</span> inside the{" "}
          <span className="font-mono text-foreground">lms/</span> folder to upload the local
          students, classes and journal data.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
      {/* Header */}
      <header className="mb-8">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-primary">
          English · Class Ledger
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Teacher&rsquo;s Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              synced {formatSyncedAt(snapshot.syncedAt)}
            </p>
            <button
              onClick={() => startRefresh(() => router.refresh())}
              title="Reload — data updates when you run npm run sync locally"
              className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            </button>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Sign out"
                className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 h-px w-full bg-gradient-to-r from-primary/50 via-border to-transparent" />
      </header>

      {/* Stats */}
      <section className="mb-8 flex flex-wrap gap-3">
        <StatBlock
          icon={<Users className="h-5 w-5" />}
          label="Active students"
          value={data.totals.activeStudents}
        />
        <StatBlock
          icon={<GraduationCap className="h-5 w-5" />}
          label="Classes logged"
          value={data.totals.classesLogged}
          sub={`${data.totals.presentTotal} given · ${data.totals.absentTotal} absences · trials not counted`}
        />
        <StatBlock
          icon={<BookOpenCheck className="h-5 w-5" />}
          label="Classes ready"
          value={data.totals.readyTotal}
          sub="prepared, not given yet"
        />
      </section>

      {/* Google Agenda */}
      <section className="mb-8">
        <AgendaPanel agenda={agenda} />
      </section>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter students…"
            className="w-full rounded-md border bg-card py-2 pl-8 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {students.length} of {data.students.length} students
        </p>
      </div>

      {/* Students table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[210px]">Student</TableHead>
              <TableHead className="w-[90px] text-center">Classes</TableHead>
              <TableHead>Last classes — click for details</TableHead>
              <TableHead className="w-[90px] text-center">Total</TableHead>
              <TableHead className="w-[150px]">Attendance</TableHead>
              <TableHead className="w-[110px] text-center">Ready</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => {
              const recent = s.history.slice(0, RECENT_COUNT).reverse();
              const upcomingNoFile = upcomingNoFileIds.has(s.id);
              const lmsStudentId = snapshot.lmsStudentIds[s.id] ?? null;
              return (
                <TableRow
                  key={s.id}
                  className={cn("hover:bg-accent/60", upcomingNoFile && ROW_UPCOMING_DANGER)}
                >
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => setOpenStudent(s)}
                  >
                    <p className="font-display text-[15px] font-semibold leading-tight">
                      {s.displayName}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {s.level ?? "Level not set"}
                    </p>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <LmsClassesCell
                      lmsStudentId={lmsStudentId}
                      counts={lmsStudentId ? classCounts[lmsStudentId] ?? null : null}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((cls, i) => (
                        <HistoryClassBadge
                          key={`${cls.date}-${cls.time}-${i}`}
                          cls={cls}
                          onClick={() =>
                            setSelectedClass({ studentId: s.id, studentName: s.name, cls })
                          }
                        />
                      ))}
                      {recent.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          no journal entries yet
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSummaryStudent(s)}
                      title={
                        s.trialWarning
                          ? "Unusual trial classes — click for the full summary"
                          : "Click for the class summary"
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-display text-lg font-semibold transition-colors hover:bg-accent"
                    >
                      {s.totalClasses}
                      {s.trialWarning && (
                        <span
                          className="font-mono text-sm leading-none text-muted-foreground"
                          title="Unusual trial classes — click for the full summary"
                        >
                          *
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <AttendanceBar
                      present={s.presentCount}
                      total={s.totalClasses}
                      onClick={() => setOpenStudent(s)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <ReadyCountBadge
                      readyCount={s.readyClasses.length}
                      partialCount={s.readyPartialCount}
                      freshCount={s.readyFreshCount}
                      upcomingNoFile={upcomingNoFile}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
        Data comes from the last <span className="text-foreground">npm run sync</span> — it reads{" "}
        <span className="text-foreground">control/journal.md</span>, the{" "}
        <span className="text-foreground">students/</span> folders and Google Agenda locally and
        uploads everything here. Trial classes (aula show) are shown in history but not counted.
      </p>

      <ClassDetailDialog selected={selectedClass} onClose={() => setSelectedClass(null)} />
      <ClassSummaryDialog
        student={summaryStudent}
        onClose={() => setSummaryStudent(null)}
        onSelectClass={(cls) =>
          summaryStudent &&
          setSelectedClass({
            studentId: summaryStudent.id,
            studentName: summaryStudent.name,
            cls,
          })
        }
      />
      <StudentDialog
        student={openStudent}
        onClose={() => setOpenStudent(null)}
        onSelectClass={(cls) =>
          openStudent &&
          setSelectedClass({ studentId: openStudent.id, studentName: openStudent.name, cls })
        }
      />
    </main>
  );
}
