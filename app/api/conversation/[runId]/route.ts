import { getRun } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";

export const maxDuration = 60;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Cold reopen: replay a conversation run's transcript-so-far as the same UI
 * message stream live turns produce, so the client rehydrates through its
 * existing chunk handling. The run is long-lived (open for the next turn), so we
 * read up to the current tail and stop rather than block on the open stream.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!(await run.exists)) {
    return Response.json({ error: "run not found" }, { status: 404, headers: CORS });
  }

  const tail = await run.getReadable().getTailIndex();
  if (tail < 0) {
    return createUIMessageStreamResponse({
      stream: new ReadableStream({ start: (c) => c.close() }),
      headers: CORS,
    });
  }

  const source = run.getReadable({ startIndex: 0 }).getReader();
  let i = -1;
  const bounded = new ReadableStream({
    async pull(controller) {
      const { done, value } = await source.read();
      if (done || i >= tail) {
        controller.close();
        return;
      }
      i++;
      controller.enqueue(value);
    },
  });
  return createUIMessageStreamResponse({ stream: bounded, headers: CORS });
}
