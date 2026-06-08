import { start, getRun } from "workflow/api";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { conversationWorkflow, turnHook } from "@/workflows/chat";

export const maxDuration = 300;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, x-ampup-mcp-key, authorization, x-workflow-run-id",
  "Access-Control-Expose-Headers": "x-workflow-run-id",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * One durable run per conversation. The first turn starts the run; follow-ups
 * resume the conversation's hook and append to the same durable stream. Either
 * way we stream back just this turn's chunks and return the run id so the client
 * can stamp it onto the conversation and resume follow-up turns (and reopen via
 * /api/conversation/[runId]).
 *
 * Auth: the MCP key comes from the AMPUP_MCP_API_KEY env (one org per deploy).
 * A per-request x-ampup-mcp-key header overrides it if you front this with your
 * own multi-tenant auth.
 */
type IncomingServer = {
  slug?: string;
  name?: string;
  url?: string;
  token?: string;
  authHeader?: string;
};
type CustomServer = {
  slug: string;
  url: string;
  token?: string;
  authHeader?: string;
};

// Sanitize the client-supplied custom MCP servers: a clean slug, an http(s)
// url, and nothing else (slug "ampup" is reserved for the built-in server).
function normalizeServers(servers: IncomingServer[] | undefined): CustomServer[] {
  if (!Array.isArray(servers)) return [];
  const seen = new Set<string>(["ampup"]);
  const out: CustomServer[] = [];
  for (const s of servers) {
    const url = (s?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    let slug = (s?.slug || s?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!slug) slug = `srv-${out.length + 1}`;
    while (seen.has(slug)) slug = `${slug}-2`;
    seen.add(slug);
    out.push({
      slug,
      url,
      token: s?.token ? String(s.token) : undefined,
      authHeader: s?.authHeader ? String(s.authHeader) : undefined,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const {
    conversationId,
    message,
    runId,
    mcpServers,
    systemPrompt,
    includeAmpup,
  }: {
    conversationId: string;
    message: UIMessage;
    runId?: string;
    mcpServers?: IncomingServer[];
    systemPrompt?: string;
    includeAmpup?: boolean;
  } = await req.json();

  const mcpToken =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined;
  if (!mcpToken && !process.env.AMPUP_MCP_API_KEY) {
    return Response.json(
      { error: "AMPUP_MCP_API_KEY is not configured" },
      { status: 401, headers: { ...CORS } },
    );
  }
  if (!conversationId || !message) {
    return Response.json(
      { error: "conversationId and message are required" },
      { status: 400, headers: { ...CORS } },
    );
  }

  if (runId) {
    const run = getRun(runId);
    const tail = await run.getReadable().getTailIndex();
    await turnHook.resume(`conv:${conversationId}`, { message, mcpToken });
    return createUIMessageStreamResponse({
      stream: run.getReadable({ startIndex: tail + 1 }),
      headers: { ...CORS, "x-workflow-run-id": runId },
    });
  }

  const run = await start(conversationWorkflow, [
    conversationId,
    mcpToken,
    message,
    normalizeServers(mcpServers),
    typeof systemPrompt === "string" ? systemPrompt : undefined,
    includeAmpup !== false,
  ]);
  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: { ...CORS, "x-workflow-run-id": run.runId },
  });
}
