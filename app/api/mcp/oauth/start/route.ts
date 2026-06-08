import crypto from "crypto";
import { startAuthorization } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  signState,
  discoverServer,
  registerOAuthClient,
  callbackUrl,
} from "@/lib/mcpOauth";

// Begin the OAuth flow for an MCP server: discover the authorization server,
// dynamically register this deployment as a client, build the PKCE authorization
// URL, stash the verifier + client info in a signed cookie, and redirect the
// user to consent. The callback finishes the exchange.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const mcpUrl = (searchParams.get("url") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  if (!/^https?:\/\//i.test(mcpUrl)) {
    return Response.json({ error: "valid ?url= required" }, { status: 400 });
  }

  const redirectUrl = callbackUrl(origin);
  try {
    const { asUrl, metadata, resource } = await discoverServer(mcpUrl);
    const clientInformation = await registerOAuthClient(asUrl, metadata, redirectUrl);
    const state = crypto.randomUUID();
    const { authorizationUrl, codeVerifier } = await startAuthorization(asUrl, {
      metadata,
      clientInformation,
      redirectUrl,
      state,
      resource: new URL(resource),
      scope: metadata?.scopes_supported?.join(" "),
    });

    const cookie = signState({
      state,
      codeVerifier,
      clientInformation,
      asUrl,
      resource,
      mcpUrl,
      name,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizationUrl.toString(),
        "Set-Cookie": `${OAUTH_COOKIE}=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_COOKIE_MAX_AGE}`,
      },
    });
  } catch (err) {
    // DCR or discovery unsupported → this provider can't be self-served.
    const msg = err instanceof Error ? err.message : "OAuth start failed";
    return Response.json(
      { error: `Could not start OAuth for this server: ${msg}` },
      { status: 502 },
    );
  }
}
