import { listServerTools } from "@/lib/mcp";
import { isBlockedUrl } from "@/lib/ssrf";

// Probe a user-supplied MCP server: connect + tools/list, report how many tools
// it exposes (and a small sample) so the Connectors UI can validate a server
// before saving it. Runs server-side so the MCP SDK never enters the bundle.
export async function POST(req: Request) {
  let body: { url?: string; token?: string; authHeader?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const url = (body.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ ok: false, error: "Enter a valid http(s) URL" }, { status: 400 });
  }
  if (isBlockedUrl(url)) {
    return Response.json(
      { ok: false, error: "That URL points at a private or reserved address." },
      { status: 400 },
    );
  }
  try {
    const tools = await listServerTools({
      slug: "probe",
      url,
      token: body.token ? String(body.token).trim() : undefined,
      authHeader: body.authHeader ? String(body.authHeader).trim() : undefined,
    });
    return Response.json({
      ok: true,
      toolCount: tools.length,
      sample: tools.slice(0, 8).map((t) => t.name),
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not connect" },
      { status: 200 },
    );
  }
}
