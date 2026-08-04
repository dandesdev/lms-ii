import { NextResponse } from "next/server";
import { validateClaimToken } from "@/lib/claims";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ valid: false, reason: "unknown" });
  }

  const result = await validateClaimToken(token);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }

  return NextResponse.json({
    valid: true,
    studentName: result.studentName,
    alreadyClaimed: result.alreadyClaimed,
  });
}
