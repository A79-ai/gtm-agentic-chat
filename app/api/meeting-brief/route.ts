// Pre / post meeting brief — a compact projection of the MCP brief tools.
import { callAmpupTool } from "@/lib/mcp";

export const maxDuration = 40;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Rec = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, n: number): string[] =>
  arr(v).map((x) => (typeof x === "string" ? x : s((x as Rec)?.text) || s((x as Rec)?.title) || s((x as Rec)?.name) || JSON.stringify(x))).filter(Boolean).slice(0, n);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const type = url.searchParams.get("type") || "pre";
  const key =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    process.env.AMPUP_MCP_API_KEY ??
    "";
  if (!key || !id) return Response.json({ error: "id + key required" }, { status: 400, headers: CORS });

  const tool = type === "post" ? "get_post_meeting_brief" : "get_pre_meeting_brief";
  let b: Rec = {};
  try {
    const res = await callAmpupTool(tool, { meeting_id: id }, key);
    if (res.ok) b = JSON.parse(res.content);
  } catch {
    return Response.json({ empty: true }, { headers: CORS });
  }

  if (type === "post") {
    const summary = (b.crm_note_update as Rec) || {};
    const pms = (b.post_meeting_summary as Rec) || {};
    const out = {
      result: s(pms.meeting_result),
      summary: s(summary.summary),
      outcome: s(summary.outcome),
      keyPoints: strs(summary.key_discussion_points, 4),
      emailSubject: s((b.email_to_customer as Rec)?.subject),
    };
    const empty = !out.result && !out.summary && !out.outcome && out.keyPoints.length === 0;
    return Response.json({ empty, ...out }, { headers: CORS });
  }

  const deal = ((b.the_deal as Rec)?.deal_snapshot as Rec) || {};
  const out = {
    stage: s(deal.stage) || s(b.deal_stage),
    nextMilestone: s(deal.next_milestone),
    confirmedNeeds: strs((b.the_deal as Rec)?.confirmed_needs, 3),
    outstandingQuestions: strs((b.the_deal as Rec)?.outstanding_questions, 3),
    risks: strs((b.the_deal as Rec)?.risks_and_blockers, 3),
  };
  const empty = !out.stage && !out.nextMilestone && !out.confirmedNeeds.length && !out.outstandingQuestions.length && !out.risks.length;
  return Response.json({ empty, ...out }, { headers: CORS });
}
