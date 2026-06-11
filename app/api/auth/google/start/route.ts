import crypto from "node:crypto";
import { buildAuthUrl, GOOGLE_STATE_COOKIE, googleConfigured } from "@/lib/googleAuth";

// Begin Google sign-in: stash a state value in a cookie and redirect to Google.
export function GET(req: Request) {
  const { origin } = new URL(req.url);
  if (!googleConfigured()) {
    return Response.json(
      { error: "Google sign-in isn't configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID();
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildAuthUrl(origin, state),
      "Set-Cookie": `${GOOGLE_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
