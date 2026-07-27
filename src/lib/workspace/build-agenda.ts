import ical, { type CalendarComponent, type CalendarResponse, type VEvent } from "node-ical";
import {
  matchStudent,
  type StudentRecord,
} from "@/lib/workspace/build-dashboard";
import type { AgendaEvent, AgendaPayload, StudentSummary } from "@/types/dashboard";

export interface AgendaConfig {
  icsUrl: string;
  keyword: string;
  lookAheadDays: number;
}

const DEFAULT_KEYWORD = "ii";

export function validateAgendaConfig(input: {
  icsUrl?: string;
  keyword?: string;
  lookAheadDays?: number;
}): AgendaConfig {
  const icsUrl = input.icsUrl?.trim() ?? "";
  if (!/^https?:\/\/.+\.ics(\?.*)?$/i.test(icsUrl)) {
    throw new Error(
      "Paste the secret Google Calendar iCal URL (it must end with .ics)."
    );
  }
  const keyword = input.keyword?.trim() || DEFAULT_KEYWORD;
  if (!keyword) throw new Error("Keyword is required (e.g. \"ii\").");
  return {
    icsUrl,
    keyword,
    lookAheadDays: Math.min(30, Math.max(1, input.lookAheadDays ?? 7)),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summaryRegex(keyword: string): RegExp {
  return new RegExp(`^\\s*aula\\s+${escapeRegex(keyword)}\\s+(.+?)\\s*$`, "i");
}

function isVEvent(c: CalendarComponent): c is VEvent {
  return c.type === "VEVENT";
}

interface Occurrence {
  start: Date;
  end: Date | null;
  summary: string;
}

function expandOccurrences(ev: VEvent, from: Date, to: Date): Occurrence[] {
  const summary = String(ev.summary ?? "");
  const durationMs =
    ev.end && ev.start ? ev.end.getTime() - ev.start.getTime() : null;

  if (!ev.rrule) {
    if (ev.start >= from && ev.start <= to) {
      return [{ start: ev.start, end: ev.end ?? null, summary }];
    }
    return [];
  }

  const exdates = new Set(
    Object.values(ev.exdate ?? {}).map((d) => new Date(d as Date).getTime())
  );

  return ev.rrule
    .between(from, to, true)
    .filter((d) => !exdates.has(d.getTime()))
    .map((d) => ({
      start: d,
      end: durationMs !== null ? new Date(d.getTime() + durationMs) : null,
      summary,
    }));
}

/** Build match records from a dashboard snapshot when Student.md isn't available. */
export function studentRecordsFromSummaries(
  students: StudentSummary[]
): StudentRecord[] {
  return students.map((s) => {
    const normalize = (v: string) =>
      v
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .trim();
    const nameKey = normalize(s.name);
    const displayKey = normalize(s.displayName);
    const tokens = new Set(nameKey.split(/\s+/).filter(Boolean));
    return {
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      tokens,
      aliases: new Set([displayKey, nameKey].filter(Boolean)),
      level: s.level,
      startDate: s.startDate,
      goals: s.goals,
      readyClasses: s.readyClasses,
      pastClassFiles: s.pastClassFiles,
    };
  });
}

/**
 * Build upcoming-class agenda from an ICS feed + dashboard student summaries.
 * Matching uses each student's display/name tokens the same way the journal does.
 */
export async function buildAgendaFromIcs(
  config: AgendaConfig,
  students: StudentSummary[],
  matchStudents: StudentRecord[]
): Promise<AgendaPayload> {
  const base: AgendaPayload = {
    configured: true,
    error: null,
    rangeDays: config.lookAheadDays,
    keyword: config.keyword,
    checkedAt: new Date().toISOString(),
    events: [],
    warningCount: 0,
  };

  let parsed: CalendarResponse;
  try {
    const res = await fetch(config.icsUrl);
    if (!res.ok) throw new Error(`Calendar fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    parsed = ical.parseICS(text);
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const from = new Date();
  const to = new Date(Date.now() + config.lookAheadDays * 24 * 60 * 60 * 1000);
  const readyById = new Map(students.map((s) => [s.id, s] as const));
  const summaryRe = summaryRegex(config.keyword);
  const events: AgendaEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || !isVEvent(component)) continue;
    const m = String(component.summary ?? "").match(summaryRe);
    if (!m) continue;

    for (const occ of expandOccurrences(component, from, to)) {
      const student = matchStudent(m[1], matchStudents);
      const summary = student ? readyById.get(student.id) : undefined;
      const readyCount = summary?.readyClasses.length ?? 0;
      events.push({
        start: occ.start.toISOString(),
        end: occ.end?.toISOString() ?? null,
        summary: occ.summary,
        studentId: student?.id ?? null,
        studentName: student?.displayName ?? null,
        readyCount,
        readyPartialCount: summary?.readyPartialCount ?? 0,
        readyFreshCount: summary?.readyFreshCount ?? 0,
        warning: !student ? "unknown-student" : readyCount === 0 ? "no-file" : null,
      });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  base.events = events;
  base.warningCount = events.filter((e) => e.warning !== null).length;
  return base;
}
