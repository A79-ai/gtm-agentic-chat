// Upload a file to the org as a DataSource via the MCP upload_file tool. The
// returned datasource_id is what the chat agent reads back with read_file.
// Optionally links the upload to an attached account/opportunity.
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

type Body = {
  file_name?: string;
  file_content_base64?: string;
  account_id?: string;
  opportunity_id?: string;
};

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) return Response.json({ error: "no key" }, { status: 401, headers: CORS });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.file_name || !body.file_content_base64) {
    return Response.json({ error: "file_name and file_content_base64 required" }, { status: 400, headers: CORS });
  }

  const args: Record<string, unknown> = {
    file_name: body.file_name,
    file_content_base64: body.file_content_base64,
  };
  if (body.opportunity_id) args.opportunity_id = body.opportunity_id;
  else if (body.account_id) args.account_id = body.account_id;

  try {
    const r = await callAmpupTool("upload_file", args, key);
    if (!r.ok) return Response.json({ ok: false, error: r.content.slice(0, 300) }, { status: 502, headers: CORS });
    let datasourceId: number | null = null;
    let status = "";
    try {
      const o = JSON.parse(r.content) as { id?: number; datasource_id?: number; status?: string };
      datasourceId = (o.id ?? o.datasource_id) ?? null;
      status = o.status || "";
    } catch {
      /* leave null — caller still gets ok */
    }
    return Response.json({ ok: true, datasourceId, fileName: body.file_name, status }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502, headers: CORS });
  }
}
