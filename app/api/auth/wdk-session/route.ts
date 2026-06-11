// Mint a short-lived per-user MCP key. The client sends its Auth0 access token;
// we exchange it on the api-service for a per-user sk-a79 key scoped to the
// caller's org/user. This replaces the shared env key in multi-tenant mode.
// Defaults to the operator's own host (AMPUP_MCP_URL minus the /mcp suffix) so a
// public clone never targets a foreign backend.
const AMPUP_API_BASE =
  process.env.AMPUP_API_BASE || (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const bearer = req.headers.get("authorization");
  if (!bearer) {
    return Response.json({ error: "missing authorization" }, { status: 401, headers: CORS });
  }

  const res = await fetch(`${AMPUP_API_BASE}/api/v1/claude-agent/wdk-session`, {
    method: "POST",
    headers: { Authorization: bearer },
  });

  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return Response.json(
      { error: error.slice(0, 300) || res.statusText },
      { status: res.status, headers: CORS }
    );
  }

  const data = await res.json();
  return Response.json(data, { headers: CORS });
}
