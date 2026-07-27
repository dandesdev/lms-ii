"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2 } from "lucide-react";
import { prefetchClassEditorChunk } from "@/lib/prefetch-class-editor";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { filenameToTitle } from "@/lib/utils";

export function ImportMarkdownButton({ studentId }: { studentId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boot = useClassBoot();

  async function handleFile(file: File) {
    const title = filenameToTitle(file.name) || file.name;
    setLoading(true);
    boot.start({ title, mode: "import" });
    prefetchClassEditorChunk();
    try {
      const markdown = await file.text();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          markdown,
          filename: file.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      boot.advance("open");
      router.refresh();
      router.push(`/class/${data.id}`);
    } catch (err) {
      boot.cancel();
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={loading}
        onMouseEnter={() => prefetchClassEditorChunk()}
        onClick={() => {
          prefetchClassEditorChunk();
          inputRef.current?.click();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        Import markdown
      </Button>
    </>
  );
}
