/**
 * Syncs local teacher data into the LMS Supabase project:
 *
 *   1. Students  — one LMS student per active local folder (level/email refreshed).
 *   2. Classes   — every file in classes/ becomes a draft, the latest
 *                  past-classes/ file becomes an archived class (deduped by filename).
 *   3. Dashboard — the exact payload the local dashboard shows (journal history,
 *                  attendance, ready files, Google Agenda) is stored as a JSON
 *                  snapshot the LMS dashboard renders 1:1.
 *
 * Usage (from lms/):  npm run sync
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDashboard,
  type DashboardPayload,
  type StudentSummary,
} from "../../app/server/data";
import { buildAgenda, type AgendaPayload } from "../../app/server/calendar";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LMS_ROOT = path.resolve(__dirname, "..");
const ENGLISH_ROOT = path.resolve(LMS_ROOT, "..");
const APP_DIR = path.join(ENGLISH_ROOT, "app");
const STUDENTS_DIR = path.join(ENGLISH_ROOT, "students");

// Keep in sync with src/types/dashboard.ts (SNAPSHOT_BUCKET / SNAPSHOT_FILE).
const SNAPSHOT_BUCKET = "lms-data";
const SNAPSHOT_FILE = "dashboard.json";
const IMAGES_BUCKET = "class-images";

interface DashboardSnapshot {
  syncedAt: string;
  dashboard: DashboardPayload;
  agenda: AgendaPayload;
  /** local folder id → LMS students.id */
  lmsStudentIds: Record<string, string>;
}

function loadEnv(): Record<string, string> {
  const envPath = path.join(LMS_ROOT, ".env.local");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function cleanEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const mailto = raw.match(/mailto:([^)\s]+)/i);
  if (mailto) return mailto[1].trim();
  const plain = raw.replace(/[\[\]]/g, "").trim();
  if (!plain || /^(tbd|n\/a|none|\(not provided\))$/i.test(plain)) return null;
  if (!plain.includes("@")) return null;
  return plain;
}

function studentEmail(folder: string): string | null {
  const file = path.join(STUDENTS_DIR, folder, "Student.md");
  if (!fs.existsSync(file)) return null;
  const md = fs.readFileSync(file, "utf8");
  const m = md.match(/\*\*Email:\*\*\s*(.+)/);
  return cleanEmail(m?.[1]?.trim().split(/\r?\n/)[0]);
}

function filenameToTitle(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  const parts = base.split("_");
  if (parts.length > 1) return parts.slice(1).join(" ").replace(/-/g, " ");
  return base.replace(/-/g, " ");
}

function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function listMd(dir: string): Array<{ name: string; full: string; mtime: number }> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => ({
      name: f,
      full: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }));
}

async function ensureBuckets(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Could not list storage buckets: ${error.message}`);
  const names = new Set((buckets ?? []).map((b) => b.name));

  if (!names.has(SNAPSHOT_BUCKET)) {
    const { error: e } = await supabase.storage.createBucket(SNAPSHOT_BUCKET, {
      public: false,
    });
    if (e) throw new Error(`Could not create ${SNAPSHOT_BUCKET} bucket: ${e.message}`);
    console.log(`+ storage bucket: ${SNAPSHOT_BUCKET}`);
  }
  if (!names.has(IMAGES_BUCKET)) {
    const { error: e } = await supabase.storage.createBucket(IMAGES_BUCKET, {
      public: true,
    });
    if (e) throw new Error(`Could not create ${IMAGES_BUCKET} bucket: ${e.message}`);
    console.log(`+ storage bucket: ${IMAGES_BUCKET} (public)`);
  }
}

interface LmsStudent {
  id: string;
  name: string;
  level: string | null;
  email: string | null;
}

async function syncStudent(
  supabase: SupabaseClient,
  existing: LmsStudent[],
  summary: StudentSummary
): Promise<LmsStudent> {
  const folder = summary.id;
  const lower = (s: string) => s.toLowerCase();

  let student =
    existing.find((s) => lower(s.name) === lower(summary.name)) ??
    existing.find(
      (s) =>
        lower(s.name) === lower(folder) ||
        lower(folder).startsWith(lower(s.name)) ||
        lower(summary.name).startsWith(lower(s.name))
    );

  const email = studentEmail(folder);

  if (!student) {
    const { data, error } = await supabase
      .from("students")
      .insert({ name: summary.name, level: summary.level, email })
      .select("id, name, level, email")
      .single();
    if (error) throw new Error(`Insert student ${summary.name}: ${error.message}`);
    console.log(`+ student: ${summary.name}`);
    existing.push(data as LmsStudent);
    return data as LmsStudent;
  }

  const patch: Record<string, string> = {};
  if (summary.level && summary.level !== student.level) patch.level = summary.level;
  if (email && !student.email) patch.email = email;
  if (summary.name !== student.name) patch.name = summary.name;
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("students").update(patch).eq("id", student.id);
    if (error) throw new Error(`Update student ${summary.name}: ${error.message}`);
    console.log(`~ student updated: ${summary.name} (${Object.keys(patch).join(", ")})`);
  }
  return student;
}

async function syncClasses(
  supabase: SupabaseClient,
  student: LmsStudent,
  folder: string
): Promise<{ imported: number; updated: number }> {
  const { data: existingClasses, error } = await supabase
    .from("classes")
    .select("id, source_filename, markdown_source, status")
    .eq("student_id", student.id);
  if (error) throw new Error(`List classes for ${student.name}: ${error.message}`);

  const byFile = new Map(
    (existingClasses ?? [])
      .filter((c) => c.source_filename)
      .map((c) => [String(c.source_filename).toLowerCase(), c])
  );

  const ready = listMd(path.join(STUDENTS_DIR, folder, "classes"));
  const past = listMd(path.join(STUDENTS_DIR, folder, "past-classes")).sort(
    (a, b) => b.mtime - a.mtime
  );
  const toImport = [
    ...ready.map((f) => ({ ...f, status: "draft" })),
    ...past.slice(0, 1).map((f) => ({ ...f, status: "archived" })),
  ];

  let imported = 0;
  let updated = 0;

  for (const file of toImport) {
    const markdown = fs.readFileSync(file.full, "utf8");
    const known = byFile.get(file.name.toLowerCase());

    if (known) {
      // Refresh the markdown seed if the local file changed. This does not
      // touch documents already edited in the LMS (Liveblocks owns those).
      if (known.markdown_source !== markdown) {
        const { error: e } = await supabase
          .from("classes")
          .update({ markdown_source: markdown })
          .eq("id", known.id);
        if (e) throw new Error(`Update class ${file.name}: ${e.message}`);
        updated++;
        console.log(`  ~ refreshed source: ${file.name}`);
      }
      continue;
    }

    const classId = randomUUID();
    const { error: e } = await supabase.from("classes").insert({
      id: classId,
      student_id: student.id,
      title: extractTitle(markdown, filenameToTitle(file.name)),
      source_filename: file.name,
      markdown_source: markdown,
      liveblocks_room_id: `class-${classId}-sec2`,
      status: file.status,
    });
    if (e) throw new Error(`Insert class ${file.name} for ${student.name}: ${e.message}`);
    imported++;
    console.log(`  + [${file.status}] ${file.name}`);
  }

  return { imported, updated };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars in lms/.env.local");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Building local dashboard payload…");
  const dashboard = buildDashboard(ENGLISH_ROOT);
  const agenda = await buildAgenda(APP_DIR, ENGLISH_ROOT);
  console.log(
    `  ${dashboard.students.length} students · ${dashboard.totals.classesLogged} classes logged · ${agenda.events.length} agenda events`
  );

  await ensureBuckets(supabase);

  const { data: existingStudents, error: listErr } = await supabase
    .from("students")
    .select("id, name, level, email");
  if (listErr) throw new Error(`List students: ${listErr.message}`);
  const existing = (existingStudents ?? []) as LmsStudent[];

  const lmsStudentIds: Record<string, string> = {};
  let totalImported = 0;
  let totalUpdated = 0;

  for (const summary of dashboard.students) {
    const student = await syncStudent(supabase, existing, summary);
    lmsStudentIds[summary.id] = student.id;
    const { imported, updated } = await syncClasses(supabase, student, summary.id);
    totalImported += imported;
    totalUpdated += updated;
  }

  const snapshot: DashboardSnapshot = {
    syncedAt: new Date().toISOString(),
    dashboard,
    agenda,
    lmsStudentIds,
  };

  const { error: uploadErr } = await supabase.storage
    .from(SNAPSHOT_BUCKET)
    .upload(SNAPSHOT_FILE, Buffer.from(JSON.stringify(snapshot)), {
      contentType: "application/json",
      upsert: true,
    });
  if (uploadErr) throw new Error(`Upload snapshot: ${uploadErr.message}`);

  console.log("\n=== SYNC DONE ===");
  console.log(`Students synced:   ${dashboard.students.length}`);
  console.log(`Classes imported:  ${totalImported}`);
  console.log(`Sources refreshed: ${totalUpdated}`);
  console.log(`Snapshot uploaded: ${SNAPSHOT_BUCKET}/${SNAPSHOT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
