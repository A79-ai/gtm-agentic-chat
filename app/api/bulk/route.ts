// Bulk mutations for the list selection bar — maps (type, action) to the
// org's MCP write tools and applies them across the selected record ids.
import { callAmpupTool } from "@/lib/mcp";

export const maxDuration = 60;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function keyOf(req: Request): string {
  return (
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    process.env.AMPUP_MCP_API_KEY ??
    ""
  );
}

type Action = { tool: string; idParam: string; valueParam?: string; fixed?: Record<string, unknown> };

// (type, action) -> MCP tool. `valueParam` actions require a `value`.
const MAP: Record<string, Record<string, Action>> = {
  deal: { stage: { tool: "change_opportunity_stage", idParam: "opportunity_id", valueParam: "stage" } },
  task: {
    complete: { tool: "update_task", idParam: "task_id", fixed: { status: "COMPLETED" } },
    priority: { tool: "update_task", idParam: "task_id", valueParam: "priority" },
  },
  meeting: { sync: { tool: "sync_meeting", idParam: "meeting_id" } },
  account: { owner: { tool: "update_account", idParam: "account_id", valueParam: "owner_id" } },
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "no key" }, { status: 401, headers: CORS });

  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; ids?: string[]; value?: string };
  const spec = body.type && body.action ? MAP[body.type]?.[body.action] : undefined;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (!spec) return Response.json({ error: "unsupported action" }, { status: 400, headers: CORS });
  if (!ids.length) return Response.json({ error: "no ids" }, { status: 400, headers: CORS });
  if (spec.valueParam && !body.value) return Response.json({ error: "value required" }, { status: 400, headers: CORS });

  const results = await mapLimit(ids, 4, async (id) => {
    const args = { [spec.idParam]: id, ...(spec.fixed || {}), ...(spec.valueParam ? { [spec.valueParam]: body.value } : {}) };
    try {
      const r = await callAmpupTool(spec.tool, args, key);
      return { id, ok: r.ok };
    } catch {
      return { id, ok: false };
    }
  });

  const done = results.filter((r) => r.ok).length;
  return Response.json({ ok: done === ids.length, done, total: ids.length, failed: results.filter((r) => !r.ok).map((r) => r.id) }, { headers: CORS });
}
