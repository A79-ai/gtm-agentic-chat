import {
  discoverAuthorizationServerMetadata,
  exchangeAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { callbackUrl, OAUTH_COOKIE, verifyState } from "@/lib/mcpOauth";

// Finish the OAuth flow: validate the signed state cookie, exchange the code for
// tokens, and hand the resulting server config back to the opener window via
// postMessage (the registry lives in the browser). Renders a tiny HTML page.
function page(message: Record<string, unknown>): Response {
  const json = JSON.stringify(message).replace(/</g, "\\u003c");
  const ok = message.type === "mcp-oauth-success";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Connecting…</title>
<style>body{font-family:system-ui,sans-serif;background:#15130f;color:#e8e4dc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}</style></head>
<body><div><p>${ok ? "Connected. You can close this window." : "Connection failed. You can close this window."}</p></div>
<script>
(function(){
  var payload = ${json};
  try { if (window.opener) window.opener.postMessage(payload, window.location.origin); } catch (e) {}
  setTimeout(function(){ try { window.close(); } catch (e) {} }, 400);
})();
</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // expire the transient state cookie
      "Set-Cookie": `${OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    },
  });
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieHeader = req.headers.get("cookie") || "";
  const raw = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${OAUTH_COOKIE}=`));
  const data = verifyState<{
    state: string;
    codeVerifier: string;
    clientInformation: Record<string, unknown>;
    asUrl: string;
    resource: string;
    mcpUrl: string;
    name: string;
  }>(raw ? raw.slice(OAUTH_COOKIE.length + 1) : undefined);

  if (oauthError) {
    return page({ type: "mcp-oauth-error", error: oauthError });
  }
  if (!data) {
    return page({ type: "mcp-oauth-error", error: "Session expired. Please try again." });
  }
  if (!(code && state) || state !== data.state) {
    return page({ type: "mcp-oauth-error", error: "Invalid authorization response." });
  }

  try {
    const metadata = await discoverAuthorizationServerMetadata(data.asUrl);
    const tokens = await exchangeAuthorization(data.asUrl, {
      metadata,
      clientInformation: data.clientInformation as never,
      authorizationCode: code,
      codeVerifier: data.codeVerifier,
      redirectUri: callbackUrl(origin),
      resource: new URL(data.resource),
    });
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    return page({
      type: "mcp-oauth-success",
      server: {
        name: data.name,
        url: data.mcpUrl,
        token: tokens.access_token,
        oauth: {
          asUrl: data.asUrl,
          resource: data.resource,
          clientInformation: data.clientInformation,
          refreshToken: tokens.refresh_token || null,
          expiresAt,
        },
      },
    });
  } catch (err) {
    return page({
      type: "mcp-oauth-error",
      error: err instanceof Error ? err.message : "Token exchange failed.",
    });
  }
}
