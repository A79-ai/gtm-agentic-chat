import { getRun } from "workflow/api";

export const maxDuration = 30;

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
 * Public, unauthenticated fetch of a shared transcript by its share id (the
 * durable run id). Returns the redacted projection stored by POST /api/share.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!(await run.exists)) {
    return Response.json({ error: "share not found" }, { status: 404, headers: CORS });
  }
  const json = (await run.returnValue) as string;
  const transcript = JSON.parse(json);
  return Response.json({ transcript }, { headers: CORS });
}
