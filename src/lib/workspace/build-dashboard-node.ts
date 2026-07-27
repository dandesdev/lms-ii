import fs from "node:fs";
import path from "node:path";
import {
  buildDashboardFromScan,
  parseJournalContent,
  type WorkspaceStudentInput,
} from "./build-dashboard";

function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();
}

export function loadActiveStudentInputs(rootDir: string): WorkspaceStudentInput[] {
  const studentsDir = path.join(rootDir, "students");
  if (!fs.existsSync(studentsDir)) return [];

  const folders = fs
    .readdirSync(studentsDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && !["inactive", "shared"].includes(d.name.toLowerCase())
    )
    .map((d) => d.name);

  return folders.map((folder) => {
    const base = path.join(studentsDir, folder);
    const studentMdPath = path.join(base, "Student.md");
    const studentMd = fs.existsSync(studentMdPath)
      ? fs.readFileSync(studentMdPath, "utf-8")
      : null;
    return {
      id: folder,
      studentMd,
      readyClassFiles: listMdFiles(path.join(base, "classes")),
      pastClassFileCount: listMdFiles(path.join(base, "past-classes")).length,
    };
  });
}

export function parseJournal(rootDir: string) {
  const file = path.join(rootDir, "control", "journal.md");
  if (!fs.existsSync(file)) return [];
  return parseJournalContent(fs.readFileSync(file, "utf-8"));
}

export function buildDashboard(rootDir: string) {
  const journalPath = path.join(rootDir, "control", "journal.md");
  const journalContent = fs.existsSync(journalPath)
    ? fs.readFileSync(journalPath, "utf-8")
    : "";
  return buildDashboardFromScan(journalContent, loadActiveStudentInputs(rootDir));
}
