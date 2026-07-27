import { createServiceClient } from "@/lib/supabase/server";
import { agendaConfigPathForOwner } from "@/lib/platform";
import {
  validateAgendaConfig,
  type AgendaConfig,
} from "@/lib/workspace/build-agenda";
import { SNAPSHOT_BUCKET } from "@/types/dashboard";

export async function loadAgendaConfig(
  ownerId: string
): Promise<AgendaConfig | null> {
  const supabase = createServiceClient();
  const path = agendaConfigPathForOwner(ownerId);
  const { data, error } = await supabase.storage.from(SNAPSHOT_BUCKET).download(path);
  if (error || !data) return null;
  try {
    const raw = JSON.parse(await data.text()) as Partial<AgendaConfig>;
    return validateAgendaConfig(raw);
  } catch {
    return null;
  }
}

export async function saveAgendaConfig(
  ownerId: string,
  config: AgendaConfig
): Promise<void> {
  const supabase = createServiceClient();
  const path = agendaConfigPathForOwner(ownerId);
  const body = Buffer.from(JSON.stringify(config));
  const { error } = await supabase.storage.from(SNAPSHOT_BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
}

export async function clearAgendaConfig(ownerId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage
    .from(SNAPSHOT_BUCKET)
    .remove([agendaConfigPathForOwner(ownerId)]);
}
