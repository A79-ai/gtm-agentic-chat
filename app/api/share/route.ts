import { start } from "workflow/api";
import { shareWorkflow } from "@/workflows/share";

export const maxDuration = 60;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN;
const CORS = {
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const MAX_BYTES = 256 * 1024; // generous for a text transcript; reject runaway blobs

/**
 * Persist a redacted, read-only chat transcript and return a public share id.
 * The body is the client-built projection (user text + final assistant text,
 * no tool trace). See chat.jsx. We store it verbatim in a durable run.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const transcript = body?.transcript;
  if (!transcript || typeof transcript !== "object" || !Array.isArray(transcript.messages)) {
    return Response.json(
      { error: "transcript.messages is required" },
      { status: 400, headers: CORS }
    );
  }
  const json = JSON.stringify(transcript);
  if (json.length > MAX_BYTES) {
    return Response.json(
      { error: "transcript too large to share" },
      { status: 413, headers: CORS }
    );
  }
  const run = await start(shareWorkflow, [json]);
  return Response.json({ id: run.runId }, { headers: CORS });
}
