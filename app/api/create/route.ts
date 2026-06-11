// Create one CRM record from a list page's "New <Entity>" form. Maps the UI
// entity type to the org's MCP create tool and forwards the validated fields.
// Mirrors /api/bulk. Meeting/owner have no create tool and are rejected.
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
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // Multi-tenant: never fall back to the shared env key. Without a per-request
  // key the route 401s instead of serving one org's data to everyone.
  if (process.env.MULTI_TENANT === "true") {
    return headerKey ?? "";
  }
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? "";
}

// (type) -> MCP create tool + the fields it accepts (others are dropped).
const MAP: Record<string, { tool: string; fields: string[]; required: string[] }> = {
  account: {
    tool: "create_account",
    fields: ["name", "industry", "sync_to_crm"],
    required: ["name"],
  },
  deal: {
    tool: "create_opportunity",
    fields: ["name", "account_id", "amount", "close_date", "stage", "sync_to_crm"],
    required: ["name", "account_id", "amount", "close_date", "stage"],
  },
  contact: {
    tool: "create_contact",
    fields: ["first_name", "last_name", "email", "phone_number", "title", "company", "sync_to_crm"],
    required: [],
  },
  task: {
    tool: "create_task",
    fields: ["parent_type", "parent_id", "subject", "body", "due_date", "priority", "sync_to_crm"],
    required: ["parent_type", "parent_id", "subject"],
  },
};

function idOf(content: string): string {
  try {
    const o = JSON.parse(content);
    return String(
      o?.id ?? o?.account?.id ?? o?.opportunity?.id ?? o?.contact?.id ?? o?.task?.id ?? ""
    );
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "no key" }, { status: 401, headers: CORS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    fields?: Record<string, unknown>;
  };
  const spec = body.type ? MAP[body.type] : undefined;
  if (!spec) {
    return Response.json({ error: "unsupported type" }, { status: 400, headers: CORS });
  }

  const input = body.fields || {};
  const missing = spec.required.filter((f) => input[f] == null || input[f] === "");
  if (missing.length) {
    return Response.json(
      { error: `missing: ${missing.join(", ")}` },
      { status: 400, headers: CORS }
    );
  }

  const args: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (input[f] != null && input[f] !== "") {
      args[f] = f === "amount" ? Number(input[f]) : input[f];
    }
  }

  try {
    const r = await callAmpupTool(spec.tool, args, key);
    if (!r.ok) {
      return Response.json(
        { ok: false, error: r.content.slice(0, 300) },
        { status: 502, headers: CORS }
      );
    }
    return Response.json({ ok: true, id: idOf(r.content) }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502, headers: CORS });
  }
}
