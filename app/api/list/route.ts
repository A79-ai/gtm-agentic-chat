// Server-side paginated list for one entity type. Calls the org's MCP list
// tool with limit/offset/search and returns a normalized page + accurate total.
import { callAmpupTool } from "@/lib/mcp";
import { LIST_TOOL, NORMALIZE, pageOf, type Rec, unwrap } from "@/lib/recordMap";

export const maxDuration = 60;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
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

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "";
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0);
  const size = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("size") || "50", 10) || 50)
  );
  const search = url.searchParams.get("search") || "";

  const spec = LIST_TOOL[type];
  const norm = NORMALIZE[type];
  if (!(spec && norm)) {
    return Response.json({ error: "unsupported type" }, { status: 400, headers: CORS });
  }

  const args: Rec = { limit: size, offset: page * size, ...(spec.args || {}) };
  if (search) {
    args.search = search;
  }

  let items: Rec[] = [];
  let total: number | null = null;
  try {
    const res = await callAmpupTool(spec.tool, args, key);
    if (res.ok) {
      const parsed = JSON.parse(res.content);
      const pg = pageOf(parsed);
      items = pg.items.map(unwrap).map((r, i) => norm(r, page * size + i));
      total = pg.total;
    }
  } catch {
    /* fall through to empty page */
  }

  return Response.json({ items, total, page, size }, { headers: CORS });
}
