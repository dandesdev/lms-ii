import type { WorkspaceStudentInput } from "./build-dashboard";

export interface ScannedClassFile {
  filename: string;
  markdown: string;
  status: "draft" | "archived";
}

export interface ScannedWorkspace {
  folderName: string;
  journalContent: string;
  students: WorkspaceStudentInput[];
  classFiles: Array<{
    folderId: string;
    file: ScannedClassFile;
  }>;
  errors: string[];
}

async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return await file.text();
}

async function listMdInDir(
  dir: FileSystemDirectoryHandle
): Promise<Array<{ name: string; mtime: number }>> {
  const files: Array<{ name: string; mtime: number }> = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "file" && name.toLowerCase().endsWith(".md")) {
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        files.push({ name, mtime: file.lastModified });
      } catch {
        files.push({ name, mtime: 0 });
      }
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function getSubdir(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

export async function scanWorkspace(
  root: FileSystemDirectoryHandle
): Promise<ScannedWorkspace> {
  const errors: string[] = [];
  const students: WorkspaceStudentInput[] = [];
  const classFiles: ScannedWorkspace["classFiles"] = [];

  let journalContent = "";
  const controlDir = await getSubdir(root, "control");
  if (!controlDir) {
    errors.push("Missing control/ folder — see /docs/getting-started");
  } else {
    try {
      const journalHandle = await controlDir.getFileHandle("journal.md");
      journalContent = await readTextFile(journalHandle);
    } catch {
      errors.push("Missing control/journal.md — see /docs/getting-started");
    }
  }

  const studentsDir = await getSubdir(root, "students");
  if (!studentsDir) {
    errors.push("Missing students/ folder — see /docs/getting-started");
    return {
      folderName: root.name,
      journalContent,
      students,
      classFiles,
      errors,
    };
  }

  for await (const [folderName, entry] of studentsDir.entries()) {
    if (entry.kind !== "directory") continue;
    if (["inactive", "shared"].includes(folderName.toLowerCase())) continue;

    const studentDir = entry as FileSystemDirectoryHandle;
    let studentMd: string | null = null;
    try {
      const mdHandle = await studentDir.getFileHandle("Student.md");
      studentMd = await readTextFile(mdHandle);
    } catch {
      errors.push(`students/${folderName}/Student.md not found`);
    }

    const classesDir = await getSubdir(studentDir, "classes");
    const pastDir = await getSubdir(studentDir, "past-classes");
    const readyFiles = classesDir ? await listMdInDir(classesDir) : [];
    const pastFiles = pastDir ? await listMdInDir(pastDir) : [];
    const readyNames = readyFiles.map((f) => f.name);

    students.push({
      id: folderName,
      studentMd,
      readyClassFiles: readyNames,
      pastClassFileCount: pastFiles.length,
    });

    if (classesDir) {
      for (const { name } of readyFiles) {
        try {
          const fh = await classesDir.getFileHandle(name);
          const markdown = await readTextFile(fh);
          classFiles.push({
            folderId: folderName,
            file: { filename: name, markdown, status: "draft" },
          });
        } catch {
          errors.push(`Could not read students/${folderName}/classes/${name}`);
        }
      }
    }

    if (pastDir && pastFiles.length > 0) {
      const latest = [...pastFiles].sort((a, b) => b.mtime - a.mtime)[0];
      try {
        const fh = await pastDir.getFileHandle(latest.name);
        const markdown = await readTextFile(fh);
        classFiles.push({
          folderId: folderName,
          file: { filename: latest.name, markdown, status: "archived" },
        });
      } catch {
        errors.push(
          `Could not read students/${folderName}/past-classes/${latest.name}`
        );
      }
    }
  }

  return {
    folderName: root.name,
    journalContent,
    students,
    classFiles,
    errors,
  };
}

export function estimateScanBytes(scan: ScannedWorkspace): number {
  let bytes = new TextEncoder().encode(scan.journalContent).length;
  for (const { file } of scan.classFiles) {
    bytes += new TextEncoder().encode(file.markdown).length;
  }
  return bytes;
}
