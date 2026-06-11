import {
  discoverAuthorizationServerMetadata,
  refreshAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";

// Refresh an OAuth access token for a connected MCP server. The client stores
// the refresh token + client info (thin-client model) and calls this when a
// token is near expiry; we never persist them server-side.
export async function POST(req: Request) {
  let body: {
    asUrl?: string;
    resource?: string;
    refreshToken?: string;
    clientInformation?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!(body.asUrl && body.refreshToken && body.clientInformation)) {
    return Response.json(
      { ok: false, error: "asUrl, refreshToken, clientInformation required" },
      { status: 400 }
    );
  }
  try {
    const metadata = await discoverAuthorizationServerMetadata(body.asUrl);
    const tokens = await refreshAuthorization(body.asUrl, {
      metadata,
      clientInformation: body.clientInformation as never,
      refreshToken: body.refreshToken,
      resource: body.resource ? new URL(body.resource) : undefined,
    });
    return Response.json({
      ok: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || body.refreshToken,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "refresh failed" },
      { status: 200 }
    );
  }
}
