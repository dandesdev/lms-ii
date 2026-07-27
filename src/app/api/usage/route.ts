import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import {
  checkQuota,
  fetchTeacherUsage,
  fetchTopClasses,
  getPlanForProfile,
} from "@/lib/usage/meter";
import { usageLevel, usagePercent } from "@/lib/usage/format";

export async function GET() {
  try {
    const profile = await requireTeacher();
    const [usage, plan, topClasses] = await Promise.all([
      fetchTeacherUsage(profile.id),
      getPlanForProfile(profile.plan),
      fetchTopClasses(profile.id),
    ]);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 500 });
    }
    const level = usageLevel(usage.total_bytes, plan.quota_bytes);
    return NextResponse.json({
      usage,
      plan,
      level,
      percent: usagePercent(usage.total_bytes, plan.quota_bytes),
      topClasses,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireTeacher();
    const body = await request.json().catch(() => ({}));
    const additionalBytes = Number(body.additionalBytes ?? 0);
    const result = await checkQuota(profile.id, profile.plan, additionalBytes);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
