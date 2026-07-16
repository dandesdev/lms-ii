"use client";

import { CalendarDays, CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpcomingClassBadge } from "@/components/dashboard/class-badge";
import { cn } from "@/lib/utils";
import { upcomingTone } from "@/lib/class-visuals";
import type { AgendaPayload } from "@/types/dashboard";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]} ${dd}/${mm} · ${hh}:${min}`;
}

function warningTitle(e: AgendaPayload["events"][number]): string {
  if (e.warning === "no-file") {
    return `${e.summary} — no class file ready in classes/`;
  }
  return `${e.summary} — couldn't match to an active student folder`;
}

export function AgendaPanel({ agenda }: { agenda: AgendaPayload | null }) {
  if (!agenda) return null;

  if (!agenda.configured) {
    return (
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            <span className="font-semibold text-foreground">Google Agenda not connected</span>{" "}
            — connect it in the local dashboard, then run{" "}
            <span className="font-mono text-foreground">npm run sync</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (agenda.error) {
    return (
      <Card className="border-[#a3341f]/40">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <CalendarX2 className="h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1">
            <span className="font-semibold text-destructive">Could not read Google Agenda.</span>{" "}
            <span className="text-muted-foreground">{agenda.error}</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  const warnings = agenda.events.filter((e) => e.warning !== null);
  const ok = agenda.events.filter((e) => e.warning === null);

  return (
    <Card className={cn(warnings.length > 0 && "border-[#a3341f]/35")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Upcoming classes — next {agenda.rangeDays} days
          <span className="ml-auto font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
            keyword &ldquo;{agenda.keyword}&rdquo; · {agenda.events.length} in agenda
            {warnings.length > 0 && (
              <span className="ml-2 text-[#a3341f]">· {warnings.length} need attention</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {agenda.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No &ldquo;Aula {agenda.keyword} &hellip;&rdquo; events found in the calendar for this
            period.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {warnings.map((e, i) => (
              <UpcomingClassBadge
                key={`w-${i}`}
                when={formatWhen(e.start)}
                studentName={e.studentName ?? e.summary}
                tone={upcomingTone(e.warning, false)}
                title={warningTitle(e)}
              />
            ))}

            {ok.map((e, i) => {
              const hasPartial = e.readyPartialCount > 0;
              const title = hasPartial
                ? `${e.summary} — ${e.readyPartialCount} partial, ${e.readyFreshCount} fresh file(s) ready`
                : `${e.summary} — ${e.readyCount} class file(s) ready`;
              return (
                <UpcomingClassBadge
                  key={`ok-${i}`}
                  when={formatWhen(e.start)}
                  studentName={e.studentName}
                  tone={upcomingTone(null, hasPartial)}
                  title={title}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
