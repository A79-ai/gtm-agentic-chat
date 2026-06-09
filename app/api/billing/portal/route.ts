import { getStripe, siteUrl } from "@/lib/stripe";
import { verify, readCookie, SESSION_COOKIE, type GoogleUser } from "@/lib/googleAuth";

export const maxDuration = 30;

// Open the Stripe-hosted Customer Portal so the user can manage / cancel their
// subscription. The customer is resolved from the SIGNED-IN user's verified
// session email — never a client-supplied email, which would let anyone open
// (and cancel/modify) another customer's subscription.
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Stripe is not configured" }, { status: 501 });

  const user = verify<GoogleUser>(readCookie(req, SESSION_COOKIE));
  if (!user?.email) return Response.json({ error: "sign in required" }, { status: 401 });

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) return Response.json({ error: "no customer for that account" }, { status: 404 });

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${siteUrl(req)}/?view=plans`,
  });
  return Response.json({ url: session.url });
}
