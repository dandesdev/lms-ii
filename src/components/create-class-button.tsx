"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { prefetchClassEditorChunk } from "@/lib/prefetch-class-editor";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";

export function CreateClassButton({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boot = useClassBoot();

  // Activity may preserve an open dialog when navigating away — close on hide.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setTitle("");
    };
  }, []);

  function openDialog() {
    prefetchClassEditorChunk();
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim() || "Untitled Class";
    setLoading(true);
    setOpen(false);
    boot.start({ title: trimmed, mode: "create" });
    prefetchClassEditorChunk();
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          title: trimmed,
          markdown: `# ${trimmed}\n\n`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create class");
      setTitle("");
      boot.advance("open");
      // Refresh the (soon-to-be-hidden) list so Activity restores a fresh roster.
      router.refresh();
      router.push(`/class/${data.id}`);
    } catch (err) {
      boot.cancel();
      alert(err instanceof Error ? err.message : "Could not create class");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={openDialog}
        onMouseEnter={() => prefetchClassEditorChunk()}
        disabled={loading}
      >
        <Plus className="h-4 w-4" />
        New class
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!loading) {
            if (next) prefetchClassEditorChunk();
            setOpen(next);
            if (!next) setTitle("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New class</DialogTitle>
            <DialogDescription>
              Start from a blank document. You can edit everything in the
              class editor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Class title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
