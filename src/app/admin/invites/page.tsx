"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InviteRow {
  id: string;
  code: string;
  email: string | null;
  note: string | null;
  can_invite_teachers: boolean;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [canDelegate, setCanDelegate] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void (async () => {
      const res = await fetch("/api/invites");
      if (res.ok) setInvites(await res.json());
    })();
  }, []);

  async function createInvite() {
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || null,
        can_invite_teachers: canDelegate,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setInvites((prev) => [data, ...prev]);
      setEmail("");
    } else {
      alert(data.error || "Failed");
    }
  }

  async function revoke(id: string) {
    await fetch("/api/invites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: id, revoked: true }),
    });
    setInvites((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i
      )
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Superuser</p>
          <h1 className="font-display text-3xl font-semibold">Teacher invites</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/usage">Usage</Link>
        </Button>
      </div>

      <div className="mb-8 space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Create a link for a new teacher account.</p>
        <Input placeholder="Email (optional hint)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={canDelegate} onChange={(e) => setCanDelegate(e.target.checked)} />
          Can invite other teachers
        </label>
        <Button onClick={createInvite}>Create invite</Button>
      </div>

      <ul className="space-y-3">
        {invites.map((inv) => {
          const link = `${origin}/invite/${inv.code}`;
          const dead = inv.used_at || inv.revoked_at;
          return (
            <li key={inv.id} className="rounded-lg border p-4 text-sm">
              <p className="font-mono text-xs break-all">{link}</p>
              <p className="mt-1 text-muted-foreground">
                {inv.email ?? "Any email"} · expires {new Date(inv.expires_at).toLocaleDateString()}
                {inv.used_at && " · used"}
                {inv.revoked_at && " · revoked"}
              </p>
              {!dead && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => revoke(inv.id)}>
                  Revoke
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
