import Link from "next/link";

export default function GettingStartedPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">English LMS</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Getting started</h1>
      <p className="mt-3 text-muted-foreground">
        Keep class files and your journal on your computer (with your AI assistant). Sync them
        into the cloud editor when you are ready to teach or collaborate.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-xl font-semibold">Workspace folder structure</h2>
        <p className="text-sm text-muted-foreground">
          Pick a single root folder that contains everything below. The dashboard{" "}
          <strong>Connect workspace</strong> button reads this tree.
        </p>
        <pre className="rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed">
{`my-workspace/
  control/
    journal.md          ← class ledger (attendance, dates)
  students/
    <folder-id>/        ← stable id (folder name)
      Student.md        ← profile; include **Email:** for student login
      classes/
        *.md            ← ready classes (synced as drafts)
      past-classes/
        *.md            ← latest file synced as archived seed`}
        </pre>
        <p className="text-sm text-muted-foreground">
          Journal format: day headers like <code>07/07/2026 - TER</code> and lines like{" "}
          <code>- 18:00: Student Name: topic and notes</code>. See your local{" "}
          <code>control/journal-format.md</code> if you use the full English folder layout.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-xl font-semibold">Step by step</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Create or open your workspace folder on your computer.</li>
          <li>Sign in to the LMS and open the teacher dashboard.</li>
          <li>Click <strong>Connect workspace</strong> and select that folder.</li>
          <li>Click <strong>Sync now</strong> after local edits (or rely on auto-sync in Chrome).</li>
          <li>Open a student&apos;s LMS classes, edit, publish, and share with students.</li>
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-xl font-semibold">Browser requirements</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chrome or Edge on desktop for folder connect and auto-sync.</li>
          <li>HTTPS (production) or localhost for development.</li>
          <li>Firefox and Safari do not support folder picking yet — use Sync now on another browser or <code>npm run sync</code> locally.</li>
        </ul>
      </section>

      <section id="space" className="mt-10 space-y-3">
        <h2 className="font-display text-xl font-semibold">Cloud space limits</h2>
        <p className="text-sm text-muted-foreground">
          Your plan includes a storage quota. The dashboard shows how much you use across:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Class markdown text stored in the database</li>
          <li>Images uploaded in the collaborative editor</li>
          <li>Your dashboard snapshot from the last sync</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          At 80% and 90% you will see warnings. At 100% new uploads and imports are blocked until
          you delete or archive content. Editing, publishing, and sharing existing classes still
          works.
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-primary underline">Back to dashboard</Link>
      </p>
    </main>
  );
}
