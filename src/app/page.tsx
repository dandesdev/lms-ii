import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isTeacherRole } from "@/types/database";

export default async function HomePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (isTeacherRole(profile.role)) {
    redirect("/dashboard");
  }

  redirect("/student");
}
