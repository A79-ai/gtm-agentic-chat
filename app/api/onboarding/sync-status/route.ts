// Live setup-progress for a freshly-onboarded trial workspace. The onboarding
// seed (demo content) and Google Calendar sync run as background backfills for
// minutes; this route proxies the backend's connect_tools sync-status so the UI
// can show real progress instead of a blind wait.
//
// Fail-open: any non-200 / error from upstream returns
// { sync_completed: true, backfills: [] } so a transient blip can never trap the
// user in a fake "still setting up" state.
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

function keyOf(req: Request): string {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.MULTI_TENANT === "true") {
    return headerKey ?? "";
  }
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? "";
}

const DONE = { sync_completed: true, backfills: [] };

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }
  try {
    const res = await fetch(
      `${apiBase()}/sales-agents/api/v1/onboarding/stage/connect_tools/sync-status`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) {
      return Response.json(DONE, { headers: CORS });
    }
    const data = await res.json();
    return Response.json(data, { headers: CORS });
  } catch {
    // Fail-open: never trap the user in a fake "setting up" state.
    return Response.json(DONE, { headers: CORS });
  }
}
