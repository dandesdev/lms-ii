import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Stripe webhook stub — activate when billing ships (Phase 5).
 * Set STRIPE_WEBHOOK_SECRET and map subscription events to profiles.plan.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  // TODO: verify with stripe.webhooks.constructEvent when Stripe SDK is added.
  void body;
  void signature;

  const supabase = createServiceClient();
  // Placeholder: no-op until Stripe integration is wired.
  await supabase.from("subscriptions").select("id").limit(1);

  return NextResponse.json({ received: true });
}
