"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBytes } from "@/lib/usage/format";
import { Button } from "@/components/ui/button";

interface TeacherRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  can_invite_teachers: boolean;
  plan: { label: string; quota_bytes: number } | string | null;
  usage: { total_bytes: number };
  formatted: string;
}

interface AdminUsageResponse {
  backend: {
    db_bytes: number;
    storage_bytes: number;
    teacher_count: number;
    student_count: number;
    class_count: number;
    room_count: number;
  } | null;
  teachers: TeacherRow[];
  alerts: string[];
  limits: { db: number; storage: number; rooms: number };
}

export default function AdminUsagePage() {
  const [data, setData] = useState<AdminUsageResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/usage");
      if (!res.ok) {
        setError("Unauthorized");
        return;
      }
      setData(await res.json());
    })();
  }, []);

  async function toggleDelegate(teacherId: string, value: boolean) {
    const res = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, can_invite_teachers: value }),
    });
    if (res.ok && data) {
      setData({
        ...data,
        teachers: data.teachers.map((t) =>
          t.id === teacherId ? { ...t, can_invite_teachers: value } : t
        ),
      });
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <p>{error}</p>
        <Link href="/dashboard" className="mt-4 text-primary underline">Dashboard</Link>
      </main>
    );
  }

  if (!data) {
    return <main className="p-10 text-center text-muted-foreground">Loading admin usage…</main>;
  }

  const b = data.backend;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Superuser</p>
          <h1 className="font-display text-3xl font-semibold">Platform usage</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/admin/invites">Invites</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="mb-6 rounded-lg border border-[#a3341f]/40 bg-[#f7e4de]/40 p-4 text-sm">
          <p className="font-semibold text-[#a3341f]">Active alerts</p>
          <ul className="mt-2 list-disc pl-5">
            {data.alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {b && (
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">Database</p>
            <p className="font-display text-xl font-semibold">{formatBytes(b.db_bytes)}</p>
            <p className="text-xs text-muted-foreground">
              of {formatBytes(data.limits.db)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">Storage</p>
            <p className="font-display text-xl font-semibold">{formatBytes(b.storage_bytes)}</p>
            <p className="text-xs text-muted-foreground">
              of {formatBytes(data.limits.storage)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">Liveblocks rooms</p>
            <p className="font-display text-xl font-semibold">{b.room_count}</p>
            <p className="text-xs text-muted-foreground">limit ~{data.limits.rooms}</p>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Teachers</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 font-mono text-[11px] uppercase">
              <tr>
                <th className="p-3 text-left">Teacher</th>
                <th className="p-3 text-left">Plan</th>
                <th className="p-3 text-left">Can invite</th>
                <th className="p-3 text-right">Used</th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{t.display_name ?? t.email}</p>
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                  </td>
                  <td className="p-3">
                    {typeof t.plan === "object" && t.plan !== null
                      ? t.plan.label
                      : String(t.plan ?? "—")}
                  </td>
                  <td className="p-3">
                    {t.role === "superuser" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={t.can_invite_teachers}
                        onChange={(e) => toggleDelegate(t.id, e.target.checked)}
                        aria-label="Can invite teachers"
                      />
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{t.formatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
