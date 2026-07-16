import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "class-images";

export async function POST(request: Request) {
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

  const ext = file.name.split(".").pop() || "png";
  const path = `${classId}/${Date.now()}.${ext}`;

  // Storage writes go through the service role — the bucket has no RLS
  // policies for end users, so user-scoped uploads are rejected.
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

  const {
    data: { publicUrl },
  } = storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
