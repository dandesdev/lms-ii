"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateClassButton } from "@/components/create-class-button";
import { ImportMarkdownButton } from "@/components/import-markdown-button";
import { StudentAccountPanel } from "@/components/student-account-panel";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { prefetchClassEditorChunk } from "@/lib/prefetch-class-editor";
import { useRefreshOnReshow } from "@/hooks/use-refresh-on-reshow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowDown, ArrowUp, BookOpen, Loader2, X } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import type { ClassStatus } from "@/types/database";

export type StudentClassListItem = {
  id: string;
  title: string;
  source_filename: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
};

type SortKey = "updated_at" | "created_at" | "started_at";
type SortDir = "desc" | "asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "updated_at", label: "Modified" },
  { key: "created_at", label: "Created" },
  { key: "started_at", label: "Started" },
];

function compareClasses(
  a: StudentClassListItem,
  b: StudentClassListItem,
  key: SortKey,
  dir: SortDir
): number {
  const aVal = a[key];
  const bVal = b[key];
  // Never-started classes sink to the bottom regardless of direction.
  if (!aVal && !bVal) return 0;
  if (!aVal) return 1;
  if (!bVal) return -1;
  const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  return dir === "asc" ? cmp : -cmp;
}

export function StudentClassesPanel({
  studentId,
  studentName,
  studentLevel,
  studentEmail,
  claimToken,
  userId,
  linkedEmail,
  claimedAt,
  initialClasses,
}: {
  studentId: string;
  studentName: string;
  studentLevel: string | null;
  studentEmail: string | null;
  claimToken: string;
  userId: string | null;
  linkedEmail: string | null;
  claimedAt: string | null;
  initialClasses: StudentClassListItem[];
}) {
  const [entered, setEntered] = useState(false);
  const [classes, setClasses] = useState(initialClasses);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [excludeTarget, setExcludeTarget] =
    useState<StudentClassListItem | null>(null);
  const [excluding, setExcluding] = useState(false);
  const boot = useClassBoot();
  const router = useRouter();
  useRefreshOnReshow();

  useEffect(() => {
    setClasses(initialClasses);
  }, [initialClasses]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) => compareClasses(a, b, sortKey, sortDir)),
    [classes, sortKey, sortDir]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

  function openClass(title: string) {
    prefetchClassEditorChunk();
    boot.start({ title, mode: "open" });
  }

  function prefetchClass(href: string) {
    router.prefetch(href);
    prefetchClassEditorChunk();
  }

  async function confirmExclude() {
    if (!excludeTarget) return;
    setExcluding(true);
    const id = excludeTarget.id;
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to exclude");
      setClasses((prev) => prev.filter((c) => c.id !== id));
      setExcludeTarget(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to exclude");
    } finally {
      setExcluding(false);
    }
  }

  return (
    <div
      className={cn(
        "transition-opacity duration-400 ease-out motion-reduce:transition-none",
        entered ? "opacity-100" : "opacity-0"
      )}
    >
      <header className="border-b border-editor-chrome bg-[#fffdf8]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard" prefetch>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{studentName}</h1>
              {studentLevel && (
                <p className="text-sm text-[#6b6558]">{studentLevel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreateClassButton studentId={studentId} />
            <ImportMarkdownButton studentId={studentId} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <StudentAccountPanel
          studentId={studentId}
          email={studentEmail}
          claimToken={claimToken}
          userId={userId}
          linkedEmail={linkedEmail}
          claimedAt={claimedAt}
        />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Classes
            </CardTitle>
            {classes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs text-[#6b6558]">
                <span className="mr-1">Sort</span>
                {SORT_OPTIONS.map(({ key, label }) => {
                  const active = sortKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSort(key)}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-2 py-1 transition-colors",
                        active
                          ? "bg-[#e6ddc8] text-[#1e4d3a] font-medium"
                          : "hover:bg-[#f5f0e6]"
                      )}
                    >
                      {label}
                      {active &&
                        (sortDir === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        ))}
                    </button>
                  );
                })}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#e8e0d0]">
              {sortedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="group flex items-center gap-2 -mx-2 px-2 rounded-md transition-colors hover:bg-[#faf7f0]"
                >
                  <Link
                    href={`/class/${cls.id}`}
                    prefetch={false}
                    onClick={() => openClass(cls.title)}
                    onMouseEnter={() => prefetchClass(`/class/${cls.id}`)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{cls.title}</p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-[#8a8272]">
                        <span title="Created">C {formatShortDate(cls.created_at)}</span>
                        <span className="mx-1.5 text-[#d0c6b4]">·</span>
                        <span title="Modified">M {formatShortDate(cls.updated_at)}</span>
                        <span className="mx-1.5 text-[#d0c6b4]">·</span>
                        <span title="Started">
                          S {cls.started_at ? formatShortDate(cls.started_at) : "—"}
                        </span>
                      </p>
                    </div>
                    <Badge
                      variant={
                        cls.status === "published" ? "success" : "warning"
                      }
                      className="shrink-0"
                    >
                      {cls.status}
                    </Badge>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-[#8a8272] hover:text-red-700 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    title="Exclude class"
                    aria-label={`Exclude ${cls.title}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setExcludeTarget(cls);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {sortedClasses.length === 0 && (
                <p className="py-6 text-center text-[#6b6558]">
                  No classes yet. Create a new class or import a markdown file.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!excludeTarget}
        onOpenChange={(open) => {
          if (!open && !excluding) setExcludeTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exclude this class?</DialogTitle>
              <DialogDescription>
              {excludeTarget
                ? `"${excludeTarget.title}" will be removed from this list and hidden from the student.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setExcludeTarget(null)}
              disabled={excluding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmExclude}
              disabled={excluding}
            >
              {excluding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Exclude
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
