// AmpUp Notetaker settings — read/write the org's notetaker config.
export const maxDuration = 30;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Rec = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const NS = "features";
export const MODES = ["disabled", "record_all", "exclude_internal_meetings", "only_internal_meetings"];

function apiBase(): string {
  return (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
}
function keyOf(req: Request): string {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // Multi-tenant: never fall back to the shared env key. Without a per-request
  // key the route 401s instead of serving one org's data to everyone.
  if (process.env.MULTI_TENANT === "true") return headerKey ?? "";
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? "";
}

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  const configs = await fetch(`${apiBase()}/api/v1/configs`, { headers: { Authorization: `Bearer ${key}` } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  const val = (name: string) => {
    const c = Array.isArray(configs) ? (configs as Rec[]).find((x) => x.namespace === NS && x.name === name) : null;
    return c ? s(c.value) : "";
  };
  let emails: string[] = [];
  try { emails = JSON.parse(val("ampup_notetaker_enabled_user_emails") || "[]"); } catch { emails = []; }
  return Response.json(
    { mode: val("ampup_notetaker_mode") || "disabled", name: val("ampup_notetaker_name") || "AmpUp Notetaker", enabledEmails: emails },
    { headers: CORS },
  );
}

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => ({}))) as Rec;

  const writes: Array<{ name: string; value: string }> = [];
  if (typeof body.mode === "string" && MODES.includes(body.mode)) writes.push({ name: "ampup_notetaker_mode", value: body.mode });
  if (typeof body.name === "string") writes.push({ name: "ampup_notetaker_name", value: body.name });
  if (!writes.length) return Response.json({ error: "nothing to update" }, { status: 400, headers: CORS });

  const results = await Promise.all(
    writes.map((w) =>
      fetch(`${apiBase()}/api/v1/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ namespace: NS, name: w.name, value: w.value, reason: "GTM app notetaker settings", scope_key: "ORG", scope_value: "" }),
      }).then((r) => r.ok),
    ),
  );
  return Response.json({ ok: results.every(Boolean) }, { headers: CORS });
}
