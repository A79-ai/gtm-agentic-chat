// Conversation persistence, proxied to the AmpUp conversations API so it's the
// server-side source of truth (cross-device) and, crucially, org/user-safe:
// AmpUp derives org_id/user_id from the authenticated key and scopes every row
// to the owner. We never trust client-supplied identity. The transcript rides
// in `extra_metadata` so reopening is self-contained. Defaults to the operator's
// own host (AMPUP_MCP_URL minus /mcp) so a public clone never targets a foreign
// backend.
const AMPUP_API_BASE =
  process.env.AMPUP_API_BASE || (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN;
const CORS = {
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
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

const upstreamHeaders = (key: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
});

const safeParse = (s: unknown): Record<string, unknown> => {
  if (typeof s !== "string" || !s) {
    return {};
  }
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
};

type Msg = { role?: string; parts?: { type?: string; text?: string }[] };
const partsText = (m: Msg | undefined) =>
  (m?.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("")
    .trim();

// Project one AmpUp conversation row to the shape the chat client renders.
function toClient(row: Record<string, unknown>) {
  const meta = safeParse(row.extra_metadata);
  const transcript = Array.isArray(meta.transcript) ? meta.transcript : [];
  return {
    id: (meta.client_id as string) || String(row.id),
    ampupId: row.id,
    runId: (row.run_id as string) || (meta.vercel_run_id as string) || null,
    title: (row.name as string) || "New chat",
    preview: (meta.preview as string) || "",
    messageCount: (meta.messageCount as number) ?? transcript.length,
    updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : Date.now(),
    messages: transcript,
  };
}

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }
  try {
    const res = await fetch(
      `${AMPUP_API_BASE}/api/v1/conversations?exclude_org_public=true&limit=50&offset=0`,
      { headers: upstreamHeaders(key) }
    );
    if (!res.ok) {
      return Response.json({ items: [], error: `upstream ${res.status}` }, { headers: CORS });
    }
    const data = (await res.json()) as { items?: Record<string, unknown>[] };
    const items = (data.items || []).map(toClient).filter((c) => c.messages.length > 0);
    return Response.json({ items }, { headers: CORS });
  } catch (e) {
    return Response.json({ items: [], error: String(e) }, { headers: CORS });
  }
}

type SaveBody = {
  ampupId?: number;
  clientId?: string;
  runId?: string | null;
  messages?: Msg[];
  deal_id?: string;
  account_id?: string;
  meeting_id?: string;
};

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!body.clientId || messages.length === 0) {
    return Response.json(
      { error: "clientId and messages required" },
      { status: 400, headers: CORS }
    );
  }

  const firstUser = messages.find((m) => m.role === "user");
  const last = messages[messages.length - 1];
  const name = (firstUser ? partsText(firstUser) : "New chat").slice(0, 80) || "New chat";
  // NB: intentionally do NOT set the top-level `run_id`. AmpUp's create runs
  // save_messages_for_run(run_id), a WDK readback that fails unless the backend
  // can reach this run, and we don't need it: the transcript is stored inline
  // in extra_metadata, and the run id is kept there (vercel_run_id) for resume.
  const payload = {
    name,
    deal_id: body.deal_id || undefined,
    account_id: body.account_id || undefined,
    meeting_id: body.meeting_id || undefined,
    extra_metadata: JSON.stringify({
      client_id: body.clientId,
      vercel_run_id: body.runId || null,
      preview: (last ? partsText(last) : "").slice(0, 120),
      messageCount: messages.length,
      transcript: messages,
    }),
  };

  try {
    const url = body.ampupId
      ? `${AMPUP_API_BASE}/api/v1/conversations/${body.ampupId}`
      : `${AMPUP_API_BASE}/api/v1/conversations`;
    const res = await fetch(url, {
      method: body.ampupId ? "PUT" : "POST",
      headers: upstreamHeaders(key),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `upstream ${res.status}` },
        { status: 502, headers: CORS }
      );
    }
    const row = (await res.json()) as { id?: number };
    return Response.json({ ok: true, ampupId: row.id ?? body.ampupId }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502, headers: CORS });
  }
}
