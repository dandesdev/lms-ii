import { createServiceClient } from "@/lib/supabase/server";
import { snapshotPathForOwner } from "@/lib/platform";
import { SNAPSHOT_BUCKET, type DashboardSnapshot } from "@/types/dashboard";

/**
 * Reads the per-teacher dashboard snapshot uploaded by workspace sync.
 * Uses the service client because the bucket is private.
 */
export async function loadDashboardSnapshot(
  ownerId: string
): Promise<DashboardSnapshot | null> {
  const supabase = createServiceClient();
  const path = snapshotPathForOwner(ownerId);
  const { data, error } = await supabase.storage.from(SNAPSHOT_BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as DashboardSnapshot;
  } catch {
    return null;
  }
}

export async function uploadDashboardSnapshot(
  ownerId: string,
  snapshot: DashboardSnapshot
): Promise<void> {
  const supabase = createServiceClient();
  const path = snapshotPathForOwner(ownerId);
  const body = Buffer.from(JSON.stringify(snapshot));
  const { error } = await supabase.storage.from(SNAPSHOT_BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
}
