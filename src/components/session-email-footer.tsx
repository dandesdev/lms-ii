/** Discreet footer showing which account is signed in. */
export function SessionEmailFooter({
  email,
}: {
  email: string | null | undefined;
}) {
  if (!email) return null;

  return (
    <footer className="px-6 py-4">
      <p className="text-center font-mono text-[11px] tracking-wide text-muted-foreground/70">
        Signed in as {email}
      </p>
    </footer>
  );
}
