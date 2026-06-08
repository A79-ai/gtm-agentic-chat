// Cross-entity typeahead for the chat attach picker — wraps the org's MCP
// search_entities tool and returns groups of {id, type, name, subtitle}.
import { callAmpupTool } from "@/lib/mcp";

export const maxDuration = 30;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const ENTITY_TYPES = ["deal", "account", "meeting"];

function keyOf(req: Request): string | undefined {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined;
  // Multi-tenant: never fall back to the shared env key. Without a per-request
  // key the route 401s instead of serving one org's data to everyone.
  if (process.env.MULTI_TENANT === "true") return headerKey;
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? undefined;
}

export async function GET(req: Request) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return Response.json({ groups: [] }, { headers: CORS });

  let groups: Array<{ type: string; total: number; items: Array<{ id: string; type: string; name: string; subtitle: string }> }> = [];
  try {
    const res = await callAmpupTool("search_entities", { query: q, entity_types: ENTITY_TYPES, limit_per_type: 8 }, key);
    if (res.ok) {
      const parsed = JSON.parse(res.content) as { groups?: Array<{ entity_type: string; total_count?: number; items?: Array<{ id: string; text?: string; subtitle?: string }> }> };
      groups = (parsed.groups || [])
        .map((g) => ({
          type: g.entity_type,
          total: g.total_count ?? (g.items || []).length,
          items: (g.items || []).map((it) => ({ id: String(it.id), type: g.entity_type, name: String(it.text || "Untitled"), subtitle: String(it.subtitle || "") })),
        }))
        .filter((g) => g.items.length);
    }
  } catch {
    /* fall through to empty */
  }
  return Response.json({ groups }, { headers: CORS });
}
