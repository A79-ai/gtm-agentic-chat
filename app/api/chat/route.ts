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
export async function POST(req: Request) {
  const {
    conversationId,
    message,
    runId,
  }: {
    conversationId: string;
    message: UIMessage;
    runId?: string;
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
  ]);
  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: { ...CORS, "x-workflow-run-id": run.runId },
  });
}
