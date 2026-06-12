// Current signed-in user: name, email, role, org, sign-in info.
// Proxies the AmpUp backend `/api/v1/user/me` (returns UserPublic, which
// includes `role`) with the per-user key. Used by the profile page + the
// role badge in the profile menu. No shared-key fallback in multi-tenant.
export const maxDuration = 15;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN;
const CORS = {
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function apiBase(): string {
  return (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
}

export async function GET(req: Request) {
  const key =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    (process.env.MULTI_TENANT === "true" ? "" : (process.env.AMPUP_MCP_API_KEY ?? ""));
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  try {
    const res = await fetch(`${apiBase()}/api/v1/user/me`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return Response.json(
        { error: "upstream", status: res.status },
        { status: res.status, headers: CORS }
      );
    }
    const u = (await res.json()) as Record<string, unknown>;
    // Return only what the UI needs (the row also carries internal fields).
    const me = {
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role ?? "user",
      org_id: u.org_id ?? "",
      title: u.title ?? null,
      region: u.region ?? null,
      first_login_at: u.first_login_at ?? null,
      last_login_at: u.last_login_at ?? null,
      login_count: u.login_count ?? 0,
    };
    return Response.json(me, { headers: CORS });
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502, headers: CORS });
  }
}
