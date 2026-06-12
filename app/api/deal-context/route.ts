// Pre-fetch the rich context for an attached deal (the get_deal_context tool),
// so the chat can seed it into the system prompt up front and the agent assesses
// progression without spending a get_deal_context tool call during the turn.
import { callAmpupTool } from "@/lib/mcp";

export const maxDuration = 30;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN;
const CORS = {
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function keyOf(req: Request): string | undefined {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined;
  // Multi-tenant: never fall back to the shared env key (don't serve one org's
  // data to every caller).
  if (process.env.MULTI_TENANT === "true") {
    return headerKey;
  }
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? undefined;
}

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  }
  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) {
    return Response.json({ context: "" }, { headers: CORS });
  }
  try {
    const res = await callAmpupTool("get_deal_context", { opportunity_id: id }, key);
    return Response.json({ context: res.ok ? res.content : "" }, { headers: CORS });
  } catch {
    return Response.json({ context: "" }, { headers: CORS });
  }
}
