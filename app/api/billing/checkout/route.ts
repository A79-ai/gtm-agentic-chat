import { findOrCreateCustomer, getStripe, siteUrl } from "@/lib/stripe";

export const maxDuration = 30;

// Create a Stripe Checkout Session for the Pro plan, with a native free trial
// (trial_period_days) unless a card is required up front. The customer is keyed
// by the signup email so status can later be read back by email (no DB).
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Stripe is not configured" }, { status: 501 });
  }

  const { planId, account } = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = (account as { email?: string })?.email;
  const name = (account as { name?: string })?.name;
  if (!email) {
    return Response.json({ error: "account email is required" }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PRICE_PRO || process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;
  if (!priceId) {
    return Response.json({ error: "STRIPE_PRICE_PRO is not set" }, { status: 501 });
  }

  const trialDays = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || 14);
  const cardRequired = /^(1|true|yes|on)$/i.test(process.env.NEXT_PUBLIC_TRIAL_CARD_REQUIRED || "");
  const base = siteUrl(req);

  const customer = await findOrCreateCustomer(stripe, email, name);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: trialDays > 0 ? { trial_period_days: trialDays } : undefined,
    payment_method_collection: cardRequired ? "always" : "if_required",
    allow_promotion_codes: true,
    success_url: `${base}/?billing=success`,
    cancel_url: `${base}/?billing=cancelled`,
    metadata: { planId: String(planId || "pro") },
  });

  return Response.json({ url: session.url });
}
