import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";

export async function GET() {
  try {
    await requireTeacher();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("name");

    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireTeacher();
    const body = await request.json();
    const { name, level, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        name: name.trim(),
        level: level?.trim() || null,
        email: email?.trim() || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
