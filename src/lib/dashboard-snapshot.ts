import { createServiceClient } from "@/lib/supabase/server";
import {
  SNAPSHOT_BUCKET,
  SNAPSHOT_FILE,
  type DashboardSnapshot,
} from "@/types/dashboard";

/**
 * Reads the dashboard snapshot uploaded by `npm run sync`.
 * Uses the service client because the bucket is private; callers must
 * gate on the teacher role before calling this.
 */
export async function loadDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(SNAPSHOT_BUCKET)
    .download(SNAPSHOT_FILE);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as DashboardSnapshot;
  } catch {
    return null;
  }
}
