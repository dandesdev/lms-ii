import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e6] p-6">
      <ResetPasswordForm hasSession={Boolean(user)} />
    </main>
  );
}
