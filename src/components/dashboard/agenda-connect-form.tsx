"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgendaPayload } from "@/types/dashboard";

export function AgendaConnectForm({
  onConnected,
}: {
  onConnected?: (agenda: AgendaPayload, syncedAt: string) => void;
}) {
  const [icsUrl, setIcsUrl] = useState("");
  const [keyword, setKeyword] = useState("ii");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/agenda");
        if (!res.ok) return;
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        if (data.keyword) setKeyword(data.keyword);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl, keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setConfigured(true);
      setMessage(
        data.agenda
          ? `Connected — ${data.agenda.events?.length ?? 0} upcoming class(es).`
          : data.message || "Saved."
      );
      if (data.agenda && data.syncedAt) {
        onConnected?.(data.agenda, data.syncedAt);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      setConfigured(false);
      setIcsUrl("");
      setMessage("Agenda disconnected.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking agenda…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        Google Agenda
      </div>
      <p className="text-xs text-muted-foreground">
        In Google Calendar → Settings → Integrate calendar → copy the{" "}
        <span className="font-mono text-foreground">Secret address in iCal format</span>.
        Events should be titled like <span className="font-mono text-foreground">Aula ii Name</span>.
      </p>
      <Input
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        value={icsUrl}
        onChange={(e) => setIcsUrl(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-28"
          placeholder="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="button" size="sm" onClick={save} disabled={saving || !icsUrl.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {configured ? "Update & refresh" : "Connect agenda"}
        </Button>
        {configured && (
          <Button type="button" size="sm" variant="ghost" onClick={disconnect} disabled={saving}>
            Disconnect
          </Button>
        )}
      </div>
      {configured && !icsUrl && (
        <p className="font-mono text-[11px] text-muted-foreground">
          Agenda is connected. Paste a new URL to replace it.
        </p>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
