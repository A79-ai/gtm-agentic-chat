import { type GoogleUser, readCookie, SESSION_COOKIE, verify } from "@/lib/googleAuth";
import { isProEmail } from "@/lib/gtm/pro";
import { customerStatus, getStripe } from "@/lib/stripe";

export const maxDuration = 15;

// Live entitlement for a workspace, read from Stripe for the SIGNED-IN user.
// Returns { configured:false } when Stripe isn't set up so the client keeps
// using the local demo trial clock. The email is taken from the verified
// session cookie — never from the request — so one user can't read another
// customer's billing state by guessing their email.
export async function GET(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ configured: false, state: "none" });
  }

  const user = verify<GoogleUser>(readCookie(req, SESSION_COOKIE));
  if (!user?.email) {
    return Response.json({ configured: true, state: "none" });
  }

  // Allowlist Pro: internal domains / explicitly granted emails are Pro without
  // a Stripe subscription (see lib/gtm/pro.js).
  if (isProEmail(user.email)) {
    return Response.json({ configured: true, state: "subscribed", plan: "pro", comp: true });
  }

  try {
    const status = await customerStatus(stripe, user.email);
    return Response.json({ configured: true, ...status });
  } catch {
    return Response.json({ configured: true, state: "none" });
  }
}
