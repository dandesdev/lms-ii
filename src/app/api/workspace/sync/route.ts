import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacher } from "@/lib/auth";
import { uploadDashboardSnapshot } from "@/lib/dashboard-snapshot";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { canonicalCollabRoomId } from "@/lib/collab-room";
import {
  buildDashboardFromScan,
  emptyAgenda,
} from "@/lib/workspace/build-dashboard";
import { checkQuota, recordUsageSnapshot } from "@/lib/usage/meter";
import { evaluateBackendAlerts } from "@/lib/usage/alerts";
import {
  extractTitleFromMarkdown,
  filenameToTitle,
} from "@/lib/utils";
import type { DashboardSnapshot } from "@/types/dashboard";
import type { WorkspaceStudentInput } from "@/lib/workspace/build-dashboard";

interface SyncBody {
  journalContent?: string;
  students?: WorkspaceStudentInput[];
  classFiles?: Array<{
    folderId: string;
    filename: string;
    markdown: string;
    status: "draft" | "archived";
  }>;
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

function studentEmailFromMd(md: string | null): string | null {
  if (!md) return null;
  const m = md.match(/\*\*Email:\*\*\s*(.+)/i);
  return cleanEmail(m?.[1]?.trim().split(/\r?\n/)[0]);
}

export async function POST(request: Request) {
  try {
    const profile = await requireTeacher();
    const body = (await request.json()) as SyncBody;
    const journalContent = body.journalContent ?? "";
    const studentInputs = body.students ?? [];
    const classFiles = body.classFiles ?? [];

    const newBytes =
      new TextEncoder().encode(journalContent).length +
      classFiles.reduce((n, f) => n + new TextEncoder().encode(f.markdown).length, 0);

    const quota = await checkQuota(profile.id, profile.plan, newBytes);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message, code: "STORAGE_FULL", level: quota.level },
        { status: 413 }
      );
    }

    const supabase = createServiceClient();
    const dashboard = buildDashboardFromScan(journalContent, studentInputs);

    const { data: existingStudents } = await supabase
      .from("students")
      .select("id, name, level, email")
      .eq("owner_id", profile.id);
    const existing = existingStudents ?? [];

    const lmsStudentIds: Record<string, string> = {};
    let imported = 0;
    let updated = 0;

    for (const summary of dashboard.students) {
      const folder = summary.id;
      const input = studentInputs.find((s) => s.id === folder);
      const email = studentEmailFromMd(input?.studentMd ?? null);
      const lower = (s: string) => s.toLowerCase();

      let student =
        existing.find((s) => lower(s.name) === lower(summary.name)) ??
        existing.find(
          (s) =>
            lower(s.name) === lower(folder) ||
            lower(folder).startsWith(lower(s.name)) ||
            lower(summary.name).startsWith(lower(s.name))
        );

      if (!student) {
        const { data, error } = await supabase
          .from("students")
          .insert({
            name: summary.name,
            level: summary.level,
            email,
            owner_id: profile.id,
          })
          .select("id, name, level, email")
          .single();
        if (error) throw error;
        student = data;
        existing.push(data);
      } else {
        const patch: Record<string, string> = {};
        if (summary.level && summary.level !== student.level) patch.level = summary.level;
        if (email && !student.email) patch.email = email;
        if (summary.name !== student.name) patch.name = summary.name;
        if (Object.keys(patch).length > 0) {
          await supabase.from("students").update(patch).eq("id", student.id);
        }
      }

      lmsStudentIds[folder] = student.id;

      const { data: existingClasses } = await supabase
        .from("classes")
        .select("id, source_filename, markdown_source, status")
        .eq("student_id", student.id);

      const byFile = new Map(
        (existingClasses ?? [])
          .filter((c) => c.source_filename)
          .map((c) => [String(c.source_filename).toLowerCase(), c])
      );

      const filesForStudent = classFiles.filter((f) => f.folderId === folder);

      for (const file of filesForStudent) {
        const known = byFile.get(file.filename.toLowerCase());
        if (known) {
          if (known.markdown_source !== file.markdown) {
            await supabase
              .from("classes")
              .update({ markdown_source: file.markdown })
              .eq("id", known.id);
            updated++;
          }
          continue;
        }

        const growthCheck = await checkQuota(
          profile.id,
          profile.plan,
          new TextEncoder().encode(file.markdown).length
        );
        if (!growthCheck.allowed) continue;

        const classId = randomUUID();
        const title = extractTitleFromMarkdown(
          file.markdown,
          filenameToTitle(file.filename)
        );
        const { error: insErr } = await supabase.from("classes").insert({
          id: classId,
          student_id: student.id,
          title,
          source_filename: file.filename,
          markdown_source: file.markdown,
          liveblocks_room_id: canonicalCollabRoomId(classId),
          status: file.status,
        });
        if (insErr) throw insErr;
        imported++;
      }
    }

    const snapshot: DashboardSnapshot = {
      syncedAt: new Date().toISOString(),
      dashboard,
      agenda: emptyAgenda(),
      lmsStudentIds,
    };

    await uploadDashboardSnapshot(profile.id, snapshot);
    await recordUsageSnapshot(profile.id);
    await evaluateBackendAlerts();

    revalidatePath("/dashboard");

    return NextResponse.json({
      ok: true,
      imported,
      updated,
      syncedAt: snapshot.syncedAt,
      warnings: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
