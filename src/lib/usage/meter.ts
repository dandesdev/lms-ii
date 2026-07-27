import { createServiceClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";
import { usageLevel } from "@/lib/usage/format";

export interface TeacherUsageRow {
  markdown_bytes: number;
  image_bytes: number;
  snapshot_bytes: number;
  total_bytes: number;
  student_count: number;
  class_count: number;
  image_count: number;
}

export interface TopClassRow {
  class_id: string;
  title: string;
  student_id: string;
  student_name: string;
  status: string;
  markdown_bytes: number;
  image_bytes: number;
  total_bytes: number;
}

export async function getPlanForProfile(planId: string): Promise<Plan | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
  return data as Plan | null;
}

export async function fetchTeacherUsage(ownerId: string): Promise<TeacherUsageRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("teacher_usage", { owner: ownerId });
  if (error) throw error;
  const row = (data as TeacherUsageRow[] | null)?.[0];
  return row ?? {
    markdown_bytes: 0,
    image_bytes: 0,
    snapshot_bytes: 0,
    total_bytes: 0,
    student_count: 0,
    class_count: 0,
    image_count: 0,
  };
}

export async function fetchTopClasses(ownerId: string, limit = 8): Promise<TopClassRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("teacher_top_classes", {
    owner: ownerId,
    limit_count: limit,
  });
  if (error) throw error;
  return (data as TopClassRow[]) ?? [];
}

export async function recordUsageSnapshot(ownerId: string): Promise<TeacherUsageRow> {
  const usage = await fetchTeacherUsage(ownerId);
  const supabase = createServiceClient();
  await supabase.from("usage_snapshots").insert({
    owner_id: ownerId,
    markdown_bytes: usage.markdown_bytes,
    image_bytes: usage.image_bytes,
    snapshot_bytes: usage.snapshot_bytes,
    total_bytes: usage.total_bytes,
    student_count: usage.student_count,
    class_count: usage.class_count,
    image_count: usage.image_count,
  });
  return usage;
}

export interface QuotaCheckResult {
  allowed: boolean;
  usage: TeacherUsageRow;
  plan: Plan;
  level: ReturnType<typeof usageLevel>;
  message?: string;
}

export async function checkQuota(
  ownerId: string,
  planId: string,
  additionalBytes = 0
): Promise<QuotaCheckResult> {
  const plan = await getPlanForProfile(planId);
  if (!plan) throw new Error("Plan not found");
  const usage = await fetchTeacherUsage(ownerId);
  const projected = usage.total_bytes + additionalBytes;
  const level = usageLevel(projected, plan.quota_bytes);
  const allowed = level !== "full";
  return {
    allowed,
    usage: { ...usage, total_bytes: projected },
    plan,
    level,
    message: allowed
      ? undefined
      : "Storage full — free space by archiving or deleting classes, or upgrade your plan.",
  };
}
