// Server-only Stripe helpers. NEVER import this from client components — it
// reads STRIPE_SECRET_KEY. Returns null when unconfigured so routes can degrade
// to a clean "not configured" response and demo mode stays the default.
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function siteUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get("origin") ||
    new URL(req.url).origin
  );
}

// One org per deploy → identity is the signup email. Find the customer by email
// (most recent) or create one. This is the "no DB" seam: Stripe is the store.
export async function findOrCreateCustomer(stripe: Stripe, email: string, name?: string) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.customers.create({ email, name: name || undefined });
}

type Status =
  | { state: "subscribed"; plan: string; trialing?: boolean; daysLeft?: number }
  | { state: "none" };

// Read the live entitlement for an email straight from Stripe (source of truth).
// A trialing subscription still means the customer is ON the plan (they completed
// checkout) — it's "subscribed", just inside its trial window. Only the absence
// of a subscription is "none".
export async function customerStatus(stripe: Stripe, email: string): Promise<Status> {
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) return { state: "none" };
  const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
  const sub = subs.data.find((s) => s.status === "active" || s.status === "trialing");
  if (!sub) return { state: "none" };
  if (sub.status === "trialing") {
    const endMs = (sub.trial_end || 0) * 1000;
    return { state: "subscribed", plan: "pro", trialing: true, daysLeft: Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000)) };
  }
  return { state: "subscribed", plan: "pro" };
}
