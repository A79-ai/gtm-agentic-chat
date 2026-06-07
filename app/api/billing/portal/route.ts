import { getStripe, siteUrl } from "@/lib/stripe";

export const maxDuration = 30;

// Open the Stripe-hosted Customer Portal so the user can manage / cancel their
// subscription. Customer is resolved by signup email.
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Stripe is not configured" }, { status: 501 });

  const { email } = await req.json().catch(() => ({}) as { email?: string });
  if (!email) return Response.json({ error: "email is required" }, { status: 400 });

  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) return Response.json({ error: "no customer for that email" }, { status: 404 });

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${siteUrl(req)}/?view=plans`,
  });
  return Response.json({ url: session.url });
}
