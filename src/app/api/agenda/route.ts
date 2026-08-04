import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import {
  clearAgendaConfig,
  loadAgendaConfig,
  saveAgendaConfig,
} from "@/lib/agenda-config";
import {
  loadDashboardSnapshot,
  uploadDashboardSnapshot,
} from "@/lib/dashboard-snapshot";
import {
  buildAgendaFromIcs,
  studentRecordsFromSummaries,
  validateAgendaConfig,
} from "@/lib/workspace/build-agenda";
import { emptyAgenda } from "@/lib/workspace/build-dashboard";

export async function GET() {
  try {
    const profile = await requireTeacher();
    const config = await loadAgendaConfig(profile.id);
    if (!config) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({
      configured: true,
      keyword: config.keyword,
      lookAheadDays: config.lookAheadDays,
      // Mask the secret ICS path — only show that it's set
      icsUrlSet: true,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireTeacher();
    const body = await request.json();

    if (body.clear) {
      await clearAgendaConfig(profile.id);
      const snapshot = await loadDashboardSnapshot(profile.id);
      if (snapshot) {
        snapshot.agenda = emptyAgenda();
        snapshot.syncedAt = new Date().toISOString();
        await uploadDashboardSnapshot(profile.id, snapshot);
      }
      revalidatePath("/dashboard");
      return NextResponse.json({ ok: true, configured: false });
    }

    // Refresh with the saved URL (no need to paste again), or save a new one.
    let config;
    if (body.refresh && !body.icsUrl) {
      config = await loadAgendaConfig(profile.id);
      if (!config) {
        return NextResponse.json(
          { error: "No agenda connected yet — paste the secret iCal URL first." },
          { status: 400 }
        );
      }
      if (typeof body.keyword === "string" && body.keyword.trim()) {
        config = { ...config, keyword: body.keyword.trim() };
      }
    } else {
      config = validateAgendaConfig({
        icsUrl: body.icsUrl,
        keyword: body.keyword,
        lookAheadDays: body.lookAheadDays,
      });
    }

    const snapshot = await loadDashboardSnapshot(profile.id);
    if (!snapshot) {
      // Only persist after we know the URL shape is valid; fetch still needs students.
      await saveAgendaConfig(profile.id, config);
      return NextResponse.json({
        ok: true,
        configured: true,
        message: "Agenda saved. Sync your workspace so upcoming classes can be matched.",
      });
    }

    const agenda = await buildAgendaFromIcs(
      config,
      snapshot.dashboard.students,
      studentRecordsFromSummaries(snapshot.dashboard.students)
    );

    // Don't keep a broken URL on first connect / update
    if (agenda.error) {
      return NextResponse.json(
        { error: agenda.error, configured: Boolean(await loadAgendaConfig(profile.id)) },
        { status: 400 }
      );
    }

    await saveAgendaConfig(profile.id, config);
    snapshot.agenda = agenda;
    snapshot.syncedAt = new Date().toISOString();
    await uploadDashboardSnapshot(profile.id, snapshot);
    revalidatePath("/dashboard");

    return NextResponse.json({
      ok: true,
      configured: true,
      agenda,
      syncedAt: snapshot.syncedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
