// Delete one conversation by its AmpUp id. AmpUp's verify_conversation_access
// 404s unless the caller owns the row (or it's org-public / linked-entity
// accessible), so a user can only delete their own conversations.
const AMPUP_API_BASE = process.env.AMPUP_API_BASE || "https://free-trial.staging.a79dev.com";
const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function keyOf(req: Request): string {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.MULTI_TENANT === "true") return headerKey ?? "";
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? "";
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const { id } = await params;
  try {
    const res = await fetch(`${AMPUP_API_BASE}/api/v1/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 502, headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502, headers: CORS });
  }
}
