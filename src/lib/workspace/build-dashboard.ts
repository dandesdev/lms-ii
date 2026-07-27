/**
 * Dashboard builder ported from ../app/server/data.ts.
 * Browser-safe — no Node fs imports. Node sync uses build-dashboard-node.ts.
 */

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ClassStatus = "present" | "absent" | "cancelled" | "no-class";
export type ClassKind = "regular" | "makeup" | "rescheduled" | "experimental";

export interface JournalEntry {
  date: string; // ISO yyyy-mm-dd
  dateLabel: string; // dd/mm/yyyy
  weekday: string; // SEG, TER...
  time: string | null; // "18:00"
  timeLabel: string; // "18:00" or "16:30–18:00" or "—"
  studentId: string | null; // matched student folder name
  rawName: string;
  description: string;
  title: string; // short version for chips/lists
  status: ClassStatus;
  kind: ClassKind;
}

export interface StudentSummary {
  id: string; // folder name
  name: string; // full name
  displayName: string; // alias or first name — for lists
  level: string | null;
  startDate: string | null;
  goals: string[] | null;
  totalClasses: number; // present + absent occurrences (trials excluded)
  presentCount: number;
  absentCount: number;
  cancelledCount: number;
  trialCount: number;
  /** More than one trial class, or a trial that isn't the student's first class */
  trialWarning: boolean;
  readyClasses: ClassFile[]; // files still in classes/
  readyFreshCount: number;
  readyPartialCount: number;
  pastClassFiles: number;
  history: ClassRef[]; // most recent first
}

export type ClassFileState = "started" | "fresh";

export interface ClassFile {
  title: string;
  fileName: string;
  state: ClassFileState;
  date: string | null;
}

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
  /** A dated file still in classes/ — this session continues next time. */
  partialContinuation: boolean;
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

export interface ClassDetail extends ClassRef {
  studentId: string;
  studentName: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                         */
/* ------------------------------------------------------------------ */

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stripParens(s: string): string {
  return s.replace(/\([^)]*\)/g, " ");
}

function tokenize(s: string): string[] {
  const cleaned = normalize(s).replace(/[^a-z0-9\s]/g, " ");
  return [...new Set(cleaned.split(/\s+/).filter(Boolean))];
}

function aliasKey(s: string): string {
  return tokenize(s).join(" ");
}

function detectStatus(desc: string): ClassStatus {
  // Parenthetical asides often mention a *future* cancellation/make-up,
  // so status keywords are only trusted outside parentheses.
  const d = normalize(stripParens(desc));
  // Explicit absence words win over "cancelled" ("Absent - student cancelled"
  // is still an absence), but "\u274c Cancelada" alone means a cancellation.
  if (/\babsent\b|ausente|no.?show|didn.?t show|nao apareceu/.test(d)) return "absent";
  if (/cancel/.test(d)) return "cancelled";
  if (desc.includes("\u274c")) return "absent";
  if (/holiday|no class|feriado|postponed|adiad|suspend/.test(d)) return "no-class";
  return "present";
}

function detectKind(desc: string): ClassKind {
  // Exact leading markers only — see control/journal-format.md.
  // Case, space, and colon are significant: "Make-Up: " / "Rescheduled: "
  const trimmed = desc.trimStart();
  if (trimmed.startsWith("Make-Up:")) return "makeup";
  if (trimmed.startsWith("Rescheduled:")) return "rescheduled";
  const d = normalize(desc);
  if (/aula show|experimental/.test(d)) return "experimental";
  return "regular";
}

function shortTitle(desc: string): string {
  let t = desc
    .replace(/[\u2705\u274c]/g, "")
    .replace(/^Make-Up:\s*/u, "")
    .replace(/^Rescheduled:\s*/u, "")
    .replace(/^[\s\u2014:.\-\u2013]+/, "")
    .trim();
  if (!t) return "Class";
  if (t.length > 64) {
    const cut = t.slice(0, 64);
    t = cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)) + "\u2026";
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Journal parsing                                                      */
/* ------------------------------------------------------------------ */

interface RawEntry {
  time: string | null;
  timeLabel: string;
  rest: string;
}

const TIME_RE =
  /^(\d{1,2}|\?{1,2})(?::(\d{2}|\?{2}))?h?(?:\s*[-\u2013]\s*(\d{1,2})(?::(\d{2}))?h?)?\s*:\s*(.+)$/;
// e.g. "Josué 16h: cancelled (holiday)" — time buried after the name
const EMBEDDED_TIME_RE = /^(.+?)\s+(\d{1,2})(?::(\d{2}))?h?\s*:\s*(.+)$/;

function pad(n: string): string {
  return n.length === 1 ? "0" + n : n;
}

function parseRawEntry(text: string): RawEntry | null {
  const m = text.match(TIME_RE);
  if (m) {
    const known = /\d/.test(m[1]);
    const time = known ? `${pad(m[1])}:${m[2] && /\d/.test(m[2]) ? m[2] : "00"}` : null;
    const end = m[3] ? `${pad(m[3])}:${m[4] ?? "00"}` : null;
    const timeLabel = time ? (end ? `${time}\u2013${end}` : time) : "?";
    return { time, timeLabel, rest: m[5].trim() };
  }
  const e = text.match(EMBEDDED_TIME_RE);
  if (e) {
    const time = `${pad(e[2])}:${e[3] ?? "00"}`;
    return { time, timeLabel: time, rest: `${e[1].trim()}: ${e[4].trim()}` };
  }
  return null;
}

function splitNameDesc(rest: string): [string, string] {
  const colon = rest.indexOf(":");
  const marker = rest.search(/[\u2705\u274c]/);
  if (colon !== -1 && (marker === -1 || colon < marker)) {
    return [rest.slice(0, colon).trim(), rest.slice(colon + 1).trim()];
  }
  if (marker !== -1) {
    return [rest.slice(0, marker).trim(), rest.slice(marker).trim()];
  }
  const dash = rest.indexOf("\u2014");
  if (dash !== -1) {
    return [rest.slice(0, dash).trim(), rest.slice(dash + 1).trim()];
  }
  return [rest.trim(), ""];
}

const HEADER_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*([A-Za-z\u00c0-\u00ff]{3})(.*)$/;

export function parseJournalContent(content: string): Omit<JournalEntry, "studentId">[] {
  const lines = content.split(/\r?\n/);

  const entries: Omit<JournalEntry, "studentId">[] = [];
  let date: string | null = null;
  let dateLabel = "";
  let weekday = "";

  const pushEntry = (raw: RawEntry) => {
    if (!date) return;
    const [rawName, description] = splitNameDesc(raw.rest);
    if (!rawName) return;
    entries.push({
      date,
      dateLabel,
      weekday,
      time: raw.time,
      timeLabel: raw.timeLabel,
      rawName,
      description,
      title: shortTitle(description || rawName),
      status: detectStatus(description || rawName),
      kind: detectKind(description || rawName),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = trimmed.match(HEADER_RE);
    if (header) {
      const [, dd, mm, yyyy, dow, remainder] = header;
      date = `${yyyy}-${mm}-${dd}`;
      dateLabel = `${dd}/${mm}/${yyyy}`;
      weekday = dow.toUpperCase();
      // Some headers carry an inline entry: "15/06/2026 - SEG- 18:00: Estela ..."
      const inline = remainder.replace(/^[\s-]+/, "").trim();
      if (inline) {
        const raw = parseRawEntry(inline);
        if (raw) pushEntry(raw);
      }
      continue;
    }

    const item = trimmed.match(/^-\s*(.+)$/);
    if (item && date) {
      const raw = parseRawEntry(item[1].trim());
      if (raw) pushEntry(raw);
    }
  }

  entries.sort((a, b) =>
    (a.date + (a.time ?? "99:99")).localeCompare(b.date + (b.time ?? "99:99")),
  );
  return entries;
}

/* ------------------------------------------------------------------ */
/* Students                                                             */
/* ------------------------------------------------------------------ */

// Fallback nicknames; the preferred place for aliases is the
// `**Aliases:**` field in each Student.md (comma-separated).
const EXTRA_ALIASES: Record<string, string[]> = {
  "Juliana Silva Macedo": ["juh"],
};

export interface StudentRecord {
  id: string;
  name: string; // full name
  displayName: string;
  tokens: Set<string>;
  aliases: Set<string>;
  level: string | null;
  startDate: string | null;
  goals: string[] | null;
  readyClasses: ClassFile[];
  pastClassFiles: number;
}

function parseFullName(md: string, folder: string): string {
  const studentHeading = md.match(/^#\s*Student:\s*(.+)$/m);
  if (studentHeading) return studentHeading[1].trim();
  const plainHeading = md.match(/^#\s+([^#\n].+)$/m);
  if (plainHeading) return plainHeading[1].trim();
  return folder;
}

function displayName(fullName: string, configuredAliases: string[]): string {
  if (configuredAliases.length > 0) {
    // Prefer a single-word alias (e.g. "Juh") over a longer one ("Juliana Macedo").
    const singleWord = configuredAliases.find((a) => !/\s/.test(a.trim()));
    if (singleWord) return singleWord.trim();
    return configuredAliases[0].trim();
  }
  return fullName.split(/\s+/)[0] ?? fullName;
}

function parseGoals(md: string): string[] {
  const inline = metaField(md, "Goals");
  if (inline) return [inline];

  const section = md.match(/^## Goals[ \t]*\r?\n([\s\S]*?)(?=\n## )/im);
  if (!section) return [];

  return section[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
function metaField(md: string, field: string): string | null {
  const m = md.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, "i"));
  return m ? m[1].trim() : null;
}

function prettifyClassFile(fileName: string): string {
  return fileName
    .replace(/\.md$/i, "")
    .replace(/^[\dX]{2,4}[-_][\dX]{2}([-_][\dX]{2,4})?[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function parseClassFile(fileName: string): ClassFile {
  const title = prettifyClassFile(fileName);
  const exactDate = fileName.match(/^(\d{4}-\d{2}-\d{2})[_-]/);

  return {
    title,
    fileName,
    state: exactDate ? "started" : "fresh",
    date: exactDate?.[1] ?? null,
  };
}

export interface WorkspaceStudentInput {
  id: string;
  studentMd: string | null;
  readyClassFiles: string[];
  pastClassFileCount: number;
}

function studentRecordFromInput(input: WorkspaceStudentInput): StudentRecord {
  const folder = input.id;
  let level: string | null = null;
  let startDate: string | null = null;
  let goals: string[] | null = null;

  const configuredAliases: string[] = [];
  const matchAliases: string[] = [...(EXTRA_ALIASES[folder] ?? [])];
  let fullName = folder;

  if (input.studentMd) {
    const md = input.studentMd;
    fullName = parseFullName(md, folder);
    level = metaField(md, "Level");
    startDate = metaField(md, "Start Date");
    goals = parseGoals(md);
    if (goals && goals.length === 0) goals = null;
    const aliasField = metaField(md, "Aliases");
    if (aliasField) {
      const parsed = aliasField.split(",").map((a) => a.trim()).filter(Boolean);
      configuredAliases.push(...parsed);
      matchAliases.push(...parsed);
    }
    matchAliases.push(fullName);
  }

  const aliases = new Set(matchAliases.map(aliasKey).filter(Boolean));
  const tokens = new Set([
    ...tokenize(folder),
    ...tokenize(fullName),
    ...matchAliases.flatMap((a) => tokenize(a)),
  ]);

  return {
    id: folder,
    name: fullName,
    displayName: displayName(fullName, configuredAliases),
    tokens,
    aliases,
    level,
    startDate,
    goals,
    readyClasses: input.readyClassFiles.map(parseClassFile),
    pastClassFiles: input.pastClassFileCount,
  };
}

export function loadStudentsFromScan(inputs: WorkspaceStudentInput[]): StudentRecord[] {
  return inputs
    .filter((i) => !["inactive", "shared"].includes(i.id.toLowerCase()))
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"))
    .map(studentRecordFromInput);
}

function matchPlain(text: string, students: StudentRecord[]): StudentRecord | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  // Exact alias wins even when tokens alone would be ambiguous
  // (e.g. "Juliana" is an explicit alias of Juliana Barroso).
  const key = tokens.join(" ");
  const byAlias = students.find((s) => s.aliases.has(key));
  if (byAlias) return byAlias;

  const matches = students.filter((s) => tokens.every((t) => s.tokens.has(t)));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Matches a name as written in the journal or calendar (e.g. "Juh",
 * "Juliana (Juh)", "Bianca Bueno", "Jordana Borges Borges") to a student
 * folder. Parenthetical nicknames are tried first, then the plain name via
 * alias or unambiguous token matching (accent- and case-insensitive).
 */
export function matchStudent(
  rawName: string,
  students: StudentRecord[],
): StudentRecord | null {
  for (const [, inner] of rawName.matchAll(/\(([^)]+)\)/g)) {
    const byParen = matchPlain(inner, students);
    if (byParen) return byParen;
  }
  return matchPlain(stripParens(rawName), students);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

function toClassRef(e: Omit<JournalEntry, "studentId">): ClassRef {
  return {
    date: e.date,
    dateLabel: e.dateLabel,
    weekday: e.weekday,
    time: e.time,
    timeLabel: e.timeLabel,
    status: e.status,
    kind: e.kind,
    title: e.title,
    description: e.description || e.title,
    partialContinuation: false,
  };
}

function normalizeTitleForMatch(s: string): string {
  return normalize(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function titleMatches(a: string, b: string): boolean {
  const na = normalizeTitleForMatch(a);
  const nb = normalizeTitleForMatch(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokens = new Set(na.split(" ").filter(Boolean));
  const overlap = nb.split(" ").filter((t) => tokens.has(t)).length;
  return overlap >= Math.min(2, nb.split(" ").filter(Boolean).length);
}

/** Journal notes that the class material was started but not finished. */
function looksLikePartialNote(desc: string): boolean {
  const d = normalize(desc);
  return (
    /nao\s+encerr/.test(d) ||
    /ainda\s+nao\s+encerr/.test(d) ||
    /arquivo\s+(ainda\s+)?(nao\s+encerr|continua)/.test(d) ||
    /continua(r)?(\s+na)?\s+proxima(\s+aula)?/.test(d) ||
    /estende\s+pra\s+proxima/.test(d) ||
    /mesmo\s+arquivo/.test(d) ||
    /\bin progress\b/.test(d) ||
    /\bnot\s+finished\b/.test(d) ||
    /\bcontinues?\s+(next|in\s+the\s+next)\b/.test(d)
  );
}

function entryMatchesReadyFile(entry: ClassRef, file: ClassFile): boolean {
  if (file.date && entry.date === file.date) return true;
  return (
    titleMatches(entry.title, file.title) ||
    titleMatches(entry.description, file.title)
  );
}

/**
 * Fresh files keep `YYYY-XX-XX` / `YYYY-MM-XX` until renamed. If the journal
 * already records that the class was given (especially as unfinished), treat
 * the file as started using the most recent matching session date so READY
 * and Last Classes stay aligned without waiting for a rename.
 */
function promoteReadyFromHistory(
  readyClasses: ClassFile[],
  history: ClassRef[],
): ClassFile[] {
  return readyClasses.map((file) => {
    if (file.state === "started") return file;

    const match = history.find(
      (e) =>
        e.status === "present" &&
        looksLikePartialNote(e.description) &&
        (titleMatches(e.title, file.title) ||
          titleMatches(e.description, file.title)),
    );
    if (!match) return file;

    return {
      ...file,
      state: "started" as const,
      date: match.date,
    };
  });
}

/**
 * Marks the history chip that still needs to be continued for each open
 * started file. Only the *latest* relevant session gets the badge — never
 * every past "não encerrou" note (those describe state at the time).
 *
 * Matching: file start date or title overlap. If the student has a single
 * open file and a newer journal note says the class didn't finish (even
 * under a drifted title, e.g. shopping while Hannah Montana is still in
 * classes/), that newer session wins.
 */
function enrichHistoryWithPartials(
  history: ClassRef[],
  readyClasses: ClassFile[],
): ClassRef[] {
  const started = readyClasses.filter((f) => f.state === "started" && f.date);
  if (started.length === 0) return history;

  const partialIdx = new Set<number>();

  for (const file of started) {
    const matchIndices: number[] = [];
    history.forEach((entry, i) => {
      if (entry.status !== "present") return;
      if (entryMatchesReadyFile(entry, file)) matchIndices.push(i);
    });

    // Single open file: also consider newer "didn't finish" sessions whose
    // title may not match the leftover filename.
    if (started.length === 1) {
      const anchor =
        matchIndices.length > 0 ? Math.min(...matchIndices) : history.length;
      history.forEach((entry, i) => {
        if (i >= anchor) return;
        if (entry.status !== "present") return;
        if (looksLikePartialNote(entry.description)) matchIndices.push(i);
      });
    }

    if (matchIndices.length === 0) continue;
    // history is most-recent-first → smallest index is the latest session
    partialIdx.add(Math.min(...matchIndices));
  }

  return history.map((entry, i) =>
    partialIdx.has(i) ? { ...entry, partialContinuation: true } : entry,
  );
}

function buildDashboardFromStudents(
  students: StudentRecord[],
  entries: Omit<JournalEntry, "studentId">[]
): DashboardPayload {

  const byStudent = new Map<string, ClassRef[]>();
  for (const s of students) byStudent.set(s.id, []);

  for (const e of entries) {
    const student = matchStudent(e.rawName, students);
    if (student) byStudent.get(student.id)!.push(toClassRef(e));
  }

  const summaries: StudentSummary[] = students.map((s) => {
    const chronological = byStudent.get(s.id)!; // oldest first
    const recentFirst = [...chronological].reverse();
    const readyClasses = promoteReadyFromHistory(s.readyClasses, recentFirst);
    const history = enrichHistoryWithPartials(recentFirst, readyClasses);
    // Trial classes ("aula show" / experimental) stay visible in the history
    // but are not counted as real classes.
    const counted = history.filter((h) => h.kind !== "experimental");
    const presentCount = counted.filter((h) => h.status === "present").length;
    const absentCount = counted.filter((h) => h.status === "absent").length;
    const cancelledCount = counted.filter((h) => h.status === "cancelled").length;
    // Normally a student has at most one trial class and it is the very
    // first one — anything else deserves the teacher's attention.
    const trialCount = history.length - counted.length;
    const trialWarning =
      trialCount > 1 ||
      (trialCount === 1 && chronological[0].kind !== "experimental");
    return {
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      level: s.level,
      startDate: s.startDate,
      goals: s.goals,
      totalClasses: presentCount + absentCount,
      presentCount,
      absentCount,
      cancelledCount,
      trialCount,
      trialWarning,
      readyClasses,
      readyFreshCount: readyClasses.filter((c) => c.state === "fresh").length,
      readyPartialCount: readyClasses.filter((c) => c.state === "started").length,
      pastClassFiles: s.pastClassFiles,
      history,
    };
  });

  const presentTotal = summaries.reduce((n, s) => n + s.presentCount, 0);
  const absentTotal = summaries.reduce((n, s) => n + s.absentCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    students: summaries,
    totals: {
      activeStudents: summaries.length,
      classesLogged: presentTotal + absentTotal,
      presentTotal,
      absentTotal,
      readyTotal: summaries.reduce((n, s) => n + s.readyClasses.length, 0),
    },
  };
}

export function buildDashboardFromScan(
  journalContent: string,
  studentInputs: WorkspaceStudentInput[]
): DashboardPayload {
  const students = loadStudentsFromScan(studentInputs);
  const entries = parseJournalContent(journalContent);
  return buildDashboardFromStudents(students, entries);
}

export function emptyAgenda(): import("@/types/dashboard").AgendaPayload {
  return {
    configured: false,
    error: null,
    rangeDays: 7,
    keyword: "",
    checkedAt: new Date().toISOString(),
    events: [],
    warningCount: 0,
  };
}

/**
 * Re-reads the journal and finds the full entry (teacher observations
 * included) for a given student, date and time.
 */
export function findClassDetailFromScan(
  journalContent: string,
  studentInputs: WorkspaceStudentInput[],
  studentId: string,
  date: string,
  time: string | null,
): ClassDetail | null {
  const students = loadStudentsFromScan(studentInputs);
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;

  const entries = parseJournalContent(journalContent);
  const entry = entries.find((e) => {
    if (e.date !== date) return false;
    if ((e.time ?? "") !== (time ?? "")) return false;
    return matchStudent(e.rawName, students)?.id === studentId;
  });
  if (!entry) return null;

  // Rebuild this student's recent history so promotion + partial rules match
  // the dashboard (file date alone is not enough for continuation sessions).
  const studentHistory = entries
    .filter((e) => matchStudent(e.rawName, students)?.id === studentId)
    .map(toClassRef)
    .reverse();
  const readyClasses = promoteReadyFromHistory(student.readyClasses, studentHistory);
  const enrichedHistory = enrichHistoryWithPartials(studentHistory, readyClasses);
  const enriched =
    enrichedHistory.find(
      (h) => h.date === date && (h.time ?? "") === (time ?? ""),
    ) ?? toClassRef(entry);

  return {
    ...enriched,
    studentId,
    studentName: student.name,
    description: entry.description || entry.title,
  };
}
