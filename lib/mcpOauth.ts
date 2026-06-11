import crypto from "node:crypto";
import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  registerClient,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  AuthorizationServerMetadata,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";

// Server-only OAuth helpers for connecting OAuth-protected MCP servers. The MCP
// SDK provides the protocol primitives (discovery, DCR, PKCE, token exchange);
// these wrap them for our serverless routes and sign the transient state cookie.

export const OAUTH_COOKIE = "mcp_oauth_state";
export const OAUTH_COOKIE_MAX_AGE = 600; // 10 min — long enough for a consent screen

const CLIENT_NAME = "GTM Agentic Chat";

// Random per-process secret used ONLY in non-production when no secret is set,
// so the OAuth-connect flow works in dev without a known constant. Never falls
// back to AMPUP_MCP_API_KEY — a signing key and a data key shouldn't be coupled.
const DEV_STATE_SECRET = crypto.randomBytes(32).toString("hex");

function stateSecret(): string {
  const s = process.env.OAUTH_STATE_SECRET || process.env.AUTH_SESSION_SECRET;
  if (s) {
    return s;
  }
  // Fail closed in production: never sign the OAuth state cookie with a
  // guessable, publicly-known constant (this is an open template).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_STATE_SECRET must be set to use the OAuth MCP-connect flow in production " +
        "(generate with `openssl rand -hex 32`)."
    );
  }
  return DEV_STATE_SECRET;
}

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Sign a small JSON payload so the callback can trust the cookie it reads back.
export function signState(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState<T = Record<string, unknown>>(token: string | undefined): T | null {
  if (!(token && token.includes("."))) {
    return null;
  }
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", stateSecret()).update(body).digest());
  if (sig.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return null;
  }
}

export type DiscoveredServer = {
  asUrl: string; // authorization server base URL
  metadata?: AuthorizationServerMetadata;
  resource: string; // canonical MCP resource URL (RFC 8707 audience binding)
};

// Resolve the authorization server + resource for an MCP server URL.
export async function discoverServer(mcpUrl: string): Promise<DiscoveredServer> {
  let asUrl: string;
  let resource = mcpUrl;
  try {
    const prm = await discoverOAuthProtectedResourceMetadata(mcpUrl);
    asUrl = (prm.authorization_servers && prm.authorization_servers[0]) || new URL(mcpUrl).origin;
    if (prm.resource) {
      resource = String(prm.resource);
    }
  } catch {
    // No protected-resource doc — fall back to the MCP origin as the AS.
    asUrl = new URL(mcpUrl).origin;
  }
  const metadata = await discoverAuthorizationServerMetadata(asUrl);
  return { asUrl, metadata, resource };
}

// Dynamically register this deployment as an OAuth client (public, PKCE).
export async function registerOAuthClient(
  asUrl: string,
  metadata: AuthorizationServerMetadata | undefined,
  redirectUrl: string
): Promise<OAuthClientInformationFull> {
  return registerClient(asUrl, {
    metadata,
    clientMetadata: {
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: metadata?.scopes_supported?.join(" "),
    },
  });
}

export function callbackUrl(origin: string): string {
  return `${origin}/api/mcp/oauth/callback`;
}
