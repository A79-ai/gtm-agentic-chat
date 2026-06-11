// Send the AmpUp Notetaker to a meeting NOW: a "test the notetaker" action for
// the settings page. Proxies to the backend recall endpoint, which dispatches a
// real Recall bot to join the given meeting URL.
const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const SUPPORTED = ["meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com"];

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  }
  const body = (await req.json().catch(() => ({}))) as { meeting_url?: string; bot_name?: string };
  const url = (body.meeting_url || "").trim();
  if (!(url && /^https?:\/\//i.test(url) && SUPPORTED.some((d) => url.includes(d)))) {
    return Response.json(
      { error: "Enter a valid Google Meet, Zoom or Teams link" },
      { status: 400, headers: CORS }
    );
  }

  // No join_at → the backend treats it as an instant join.
  const res = await fetch(`${apiBase()}/sales-agents/api/v1/recall/bot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      meeting_url: url,
      bot_name: body.bot_name || "AmpUp Notetaker",
      meeting_name: "Notetaker test",
    }),
  }).catch(() => null);

  if (!(res && res.ok)) {
    const detail = res ? await res.text().catch(() => "") : "network error";
    return Response.json(
      { error: "Couldn't dispatch the notetaker", detail: detail.slice(0, 300) },
      { status: res?.status || 502, headers: CORS }
    );
  }
  const data = await res.json().catch(() => ({}));
  return Response.json({ ok: true, bot: data }, { headers: CORS });
}
