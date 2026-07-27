import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { checkQuota, recordUsageSnapshot } from "@/lib/usage/meter";

const BUCKET = "class-images";

export async function POST(request: Request) {
  const profile = await requireTeacher().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const classId = formData.get("classId") as string | null;

  if (!file || !classId) {
    return NextResponse.json({ error: "Missing file or classId" }, { status: 400 });
  }

  const quota = await checkQuota(profile.id, profile.plan, file.size);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.message, code: "STORAGE_FULL" },
      { status: 413 }
    );
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${profile.id}/${classId}/${Date.now()}.${ext}`;

  const storage = createServiceClient().storage;

  let { error: uploadError } = await storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError && /bucket not found/i.test(uploadError.message)) {
    await storage.createBucket(BUCKET, { public: true });
    ({ error: uploadError } = await storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined }));
  }

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await recordUsageSnapshot(profile.id);

  const {
    data: { publicUrl },
  } = storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
