import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { error: uploadError } = await supabase.storage
    .from("class-images")
    .upload(path, file, { upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("class-images").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
