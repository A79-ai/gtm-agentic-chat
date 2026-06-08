import {
  verify,
  readCookie,
  googleConfigured,
  clearSessionCookie,
  SESSION_COOKIE,
  type GoogleUser,
} from "@/lib/googleAuth";

// Current signed-in user (from the session cookie) + whether Google sign-in is
// configured, so the client can decide whether to show the button.
export function GET(req: Request) {
  const user = verify<GoogleUser>(readCookie(req, SESSION_COOKIE));
  return Response.json({ user: user || null, googleEnabled: googleConfigured() });
}

// Sign out: clear the session cookie.
export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
