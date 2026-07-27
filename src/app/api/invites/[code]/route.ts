import { NextResponse } from "next/server";
import { validateInviteCode } from "@/lib/invites";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const result = await validateInviteCode(code);
  if (result.state !== "valid") {
    return NextResponse.json({ state: result.state, valid: false });
  }
  return NextResponse.json({
    valid: true,
    state: "valid",
    email: result.invite.email,
    plan: result.invite.plan,
  });
}
