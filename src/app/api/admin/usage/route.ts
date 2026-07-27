import { NextResponse } from "next/server";
import { requireSuperuser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchTeacherUsage } from "@/lib/usage/meter";
import { evaluateBackendAlerts, getActiveAlertMessages } from "@/lib/usage/alerts";
import { formatBytes } from "@/lib/usage/format";

export async function GET() {
  try {
    await requireSuperuser();
    const supabase = createServiceClient();

    const { data: backend } = await supabase.rpc("backend_usage");
    const backendRow = (backend as Array<{
      db_bytes: number;
      storage_bytes: number;
      teacher_count: number;
      student_count: number;
      class_count: number;
      room_count: number;
    }> | null)?.[0];

    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, plan, can_invite_teachers, created_at")
      .in("role", ["teacher", "superuser"])
      .order("created_at");

    const teacherUsage = await Promise.all(
      (teachers ?? []).map(async (t) => {
        const usage = await fetchTeacherUsage(t.id);
        const { data: plan } = await supabase
          .from("plans")
          .select("*")
          .eq("id", t.plan)
          .maybeSingle();
        return {
          ...t,
          usage,
          plan,
          formatted: formatBytes(usage.total_bytes),
        };
      })
    );

    const alerts = await getActiveAlertMessages();

    return NextResponse.json({
      backend: backendRow,
      teachers: teacherUsage,
      alerts,
      limits: {
        db: Number(process.env.BACKEND_DB_LIMIT_BYTES ?? 524288000),
        storage: Number(process.env.BACKEND_STORAGE_LIMIT_BYTES ?? 1073741824),
        rooms: Number(process.env.BACKEND_LIVEBLOCKS_MAU_LIMIT ?? 100),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST() {
  try {
    await requireSuperuser();
    const messages = await evaluateBackendAlerts();
    return NextResponse.json({ ok: true, messages });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
