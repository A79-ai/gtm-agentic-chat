import { getStripe, customerStatus } from "@/lib/stripe";

export const maxDuration = 15;

// Live entitlement for a workspace, read from Stripe by signup email. Returns
// { configured:false } when Stripe isn't set up so the client keeps using the
// local demo trial clock.
export async function GET(req: Request) {
  const stripe = getStripe();
  if (!stripe) return Response.json({ configured: false, state: "none" });

  const email = new URL(req.url).searchParams.get("email");
  if (!email) return Response.json({ configured: true, state: "none" });

  try {
    const status = await customerStatus(stripe, email);
    return Response.json({ configured: true, ...status });
  } catch {
    return Response.json({ configured: true, state: "none" });
  }
}
