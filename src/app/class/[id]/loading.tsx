import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 bg-[#fffdf8] text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Opening class…
    </main>
  );
}
