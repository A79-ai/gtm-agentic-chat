import crypto from "node:crypto";

// Lightweight "Sign in with Google" (OIDC authorization-code flow) for the
// signup surface. No database and no auth library: Google returns a verified
// email/name, which we put in a signed, httpOnly session cookie. The same email
// keys the existing trial/billing. Inert until GOOGLE_CLIENT_ID/SECRET are set.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const SESSION_COOKIE = "gtm_session";
export const GOOGLE_STATE_COOKIE = "gtm_google_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Random per-process secret used ONLY in non-production when no secret is set
// (so dev works out of the box without shipping a known constant). Cookies
// signed with it don't survive a restart — fine for local dev.
const DEV_SESSION_SECRET = crypto.randomBytes(32).toString("hex");

function sessionSecret(): string {
  const s = process.env.AUTH_SESSION_SECRET || process.env.OAUTH_STATE_SECRET;
  if (s) {
    return s;
  }
  // Fail closed in production: never sign session cookies with a guessable,
  // publicly-known constant (this is an open template).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SESSION_SECRET must be set when Google sign-in is enabled in production " +
        "(generate with `openssl rand -hex 32`)."
    );
  }
  return DEV_SESSION_SECRET;
}

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function sign(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verify<T = Record<string, unknown>>(token: string | undefined): T | null {
  if (!(token && token.includes("."))) {
    return null;
  }
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  if (sig.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(fromB64url(body).toString());
  } catch {
    return null;
  }
}

export type GoogleUser = { email: string; name?: string; picture?: string };

export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange the authorization code for tokens and read the verified profile from
// the id_token. The id_token comes directly from Google's token endpoint over
// TLS in the code flow, so the payload is trusted without re-verifying its
// signature.
export async function exchangeCode(origin: string, code: string): Promise<GoogleUser> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("No id_token from Google");
  }
  const payloadPart = data.id_token.split(".")[1];
  const claims = JSON.parse(fromB64url(payloadPart).toString()) as {
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };
  if (!claims.email) {
    throw new Error("Google did not return an email");
  }
  return { email: claims.email, name: claims.name, picture: claims.picture };
}

export function sessionCookie(user: GoogleUser): string {
  const token = sign({ ...user, iat: undefined });
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") || "";
  const hit = header.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}
