// Accurate per-type record totals for the home grid, Records flyout and sheet.
// Calls each MCP list tool with limit:1 and returns the `total` it reports, so
// the counts match the real list pages (e.g. 2486 tasks) instead of the capped
// /api/records store (50/200…). Owner has no list tool, so derived client-side.
import { callAmpupTool } from "@/lib/mcp";
import { LIST_TOOL, pageOf, type Rec } from "@/lib/recordMap";

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
  // Multi-tenant: never fall back to the shared env key. Without a per-request
  // key the route 401s instead of serving one org's data to everyone.
  if (process.env.MULTI_TENANT === "true") {
    return headerKey;
  }
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? undefined;
}

async function countOf(type: string, key: string): Promise<number | null> {
  const spec = LIST_TOOL[type];
  if (!spec) {
    return null;
  }
  try {
    const args: Rec = { limit: 1, offset: 0, ...(spec.args || {}) };
    const res = await callAmpupTool(spec.tool, args, key);
    if (!res.ok) {
      return null;
    }
    return pageOf(JSON.parse(res.content)).total;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  }

  const types = Object.keys(LIST_TOOL);
  const totals = await Promise.all(types.map((t) => countOf(t, key)));
  const counts: Record<string, number> = {};
  types.forEach((t, i) => {
    if (typeof totals[i] === "number") {
      counts[t] = totals[i] as number;
    }
  });

  return Response.json({ counts }, { headers: CORS });
}
