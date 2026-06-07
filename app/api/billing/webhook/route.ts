import { getStripe } from "@/lib/stripe";

export const maxDuration = 30;

// Stripe webhook. Entitlement is read live by email on load, so this endpoint
// exists mainly to verify signatures and acknowledge subscription lifecycle
// events (a hook for future provisioning / Slack notifications). Stripe needs
// the RAW request body for signature verification — do not parse it as JSON.
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "Stripe webhook is not configured" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature") || "";
  const body = await req.text();
  let event: import("stripe").Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // No-op for now: status is read live by email. Add side-effects here.
      break;
    default:
      break;
  }

  return Response.json({ received: true });
}
