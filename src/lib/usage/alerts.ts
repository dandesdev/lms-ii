import { createServiceClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/usage/format";

const THRESHOLDS = [70, 85, 95] as const;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM ?? "LMS Alerts <onboarding@resend.dev>";
  const to = process.env.SUPERUSER_EMAIL;
  if (!apiKey || !to) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });
}

async function upsertAlert(
  resource: string,
  scopeId: string | null,
  threshold: number,
  percent: number
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("usage_alerts")
    .select("id, notified_at")
    .eq("resource", resource)
    .eq("threshold", threshold)
    .is("cleared_at", null)
    .maybeSingle();

  if (existing?.notified_at) return false;

  if (!existing) {
    await supabase.from("usage_alerts").insert({
      resource,
      scope_id: scopeId,
      threshold,
      percent,
      notified_at: new Date().toISOString(),
    });
    return true;
  }

  await supabase
    .from("usage_alerts")
    .update({ notified_at: new Date().toISOString(), percent })
    .eq("id", existing.id);
  return true;
}

async function clearAlertsBelow(resource: string, scopeId: string | null, percent: number) {
  const supabase = createServiceClient();
  const { data: active } = await supabase
    .from("usage_alerts")
    .select("id, threshold")
    .eq("resource", resource)
    .is("cleared_at", null);

  for (const row of active ?? []) {
    if (percent < row.threshold) {
      await supabase
        .from("usage_alerts")
        .update({ cleared_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
}

export async function evaluateBackendAlerts(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: backend } = await supabase.rpc("backend_usage");
  const row = (backend as Array<{
    db_bytes: number;
    storage_bytes: number;
    teacher_count: number;
    student_count: number;
    class_count: number;
    room_count: number;
  }> | null)?.[0];

  if (!row) return [];

  const dbLimit = envInt("BACKEND_DB_LIMIT_BYTES", 524288000);
  const storageLimit = envInt("BACKEND_STORAGE_LIMIT_BYTES", 1073741824);
  const roomLimit = envInt("BACKEND_LIVEBLOCKS_MAU_LIMIT", 100);

  const messages: string[] = [];

  const checks: Array<{ resource: string; used: number; limit: number; label: string }> = [
    { resource: "supabase_db", used: row.db_bytes, limit: dbLimit, label: "Supabase database" },
    { resource: "supabase_storage", used: row.storage_bytes, limit: storageLimit, label: "Supabase storage" },
    { resource: "liveblocks_rooms", used: row.room_count, limit: roomLimit, label: "Liveblocks rooms" },
  ];

  for (const check of checks) {
    const percent = check.limit > 0 ? (check.used / check.limit) * 100 : 0;
    await clearAlertsBelow(check.resource, null, percent);

    for (const threshold of THRESHOLDS) {
      if (percent >= threshold) {
        const shouldEmail = await upsertAlert(check.resource, null, threshold, percent);
        const msg = `${check.label} at ${percent.toFixed(1)}% (${formatBytes(check.used)} of ${formatBytes(check.limit)})`;
        messages.push(msg);
        if (shouldEmail) {
          await sendAlertEmail(
            `LMS alert: ${check.label} ≥ ${threshold}%`,
            `${msg}\n\nOpen the admin usage page to review headroom.`
          );
        }
      }
    }
  }

  return messages;
}

export async function getActiveAlertMessages(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("usage_alerts")
    .select("resource, threshold, percent")
    .is("cleared_at", null)
    .order("threshold", { ascending: false });

  return (data ?? []).map(
    (a) => `${a.resource.replace(/_/g, " ")} at ${Number(a.percent).toFixed(0)}% (threshold ${a.threshold}%)`
  );
}
