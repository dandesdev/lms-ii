import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recordUsageSnapshot } from "@/lib/usage/meter";
import { evaluateBackendAlerts } from "@/lib/usage/alerts";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["teacher", "superuser"]);

  for (const t of teachers ?? []) {
    await recordUsageSnapshot(t.id);
  }

  const messages = await evaluateBackendAlerts();
  return NextResponse.json({ ok: true, teachers: teachers?.length ?? 0, messages });
}
