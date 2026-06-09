import { callAmpupTool } from "@/lib/mcp";
import { friendlyDate, taskSource } from "@/lib/recordMap";

export const maxDuration = 60;

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

function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function itemsOf(parsed: unknown): Rec[] {
  if (Array.isArray(parsed)) return parsed as Rec[];
  if (parsed && typeof parsed === "object") {
    const o = parsed as Rec;
    for (const k of ["items", "tasks", "meetings", "contacts", "results"]) {
      if (Array.isArray(o[k])) return o[k] as Rec[];
    }
  }
  return [];
}

async function list(name: string, args: Rec, key?: string): Promise<Rec[]> {
  try {
    const res = await callAmpupTool(name, args, key);
    if (!res.ok) return [];
    return itemsOf(parse(res.content)).map((r) =>
      r && typeof r === "object" && "task" in r ? (r.task as Rec) : r,
    );
  } catch {
    return [];
  }
}

function money(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!v || Number.isNaN(v)) return "";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

const s = (v: unknown): string => (v == null ? "" : String(v));

export async function GET(req: Request) {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined;
  const multiTenant = process.env.MULTI_TENANT === "true";
  // Multi-tenant: require a per-request key (no shared env fallback) so an
  // unauthenticated call 401s instead of serving one org's data.
  if (multiTenant && !headerKey) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }
  const key = headerKey ?? (multiTenant ? undefined : process.env.AMPUP_MCP_API_KEY);
  if (!key) {
    return Response.json({ error: "AMPUP_MCP_API_KEY not configured" }, { status: 401, headers: CORS });
  }

  const [rawAccounts, rawDeals, rawMeetings, rawTasks] = await Promise.all([
    list("list_accounts", { limit: 200 }, key),
    list("list_opportunities", { limit: 200 }, key),
    list("list_meetings", { limit: 50, only_my_meetings: false }, key),
    list("list_tasks", { limit: 200 }, key),
  ]);

  const owners = new Map<string, Rec>();
  const noteOwner = (id: unknown, name: unknown) => {
    const oid = s(id);
    if (!oid) return;
    if (!owners.has(oid)) {
      owners.set(oid, {
        id: oid,
        type: "owner",
        name: s(name) || "Unknown owner",
        role: "Sales",
        region: "",
        email: "",
        quota: "",
        openDeals: 0,
      });
    } else if (name && !owners.get(oid)!.name) {
      owners.get(oid)!.name = s(name);
    }
  };

  const accounts = rawAccounts.map((a) => {
    noteOwner(a.owner_id, a.owner_name);
    const status = s(a.status);
    return {
      id: s(a.id),
      type: "account",
      name: s(a.name) || "Untitled account",
      industry: s(a.industry),
      size: "",
      location: "",
      arr: money(a.total_pipeline),
      health: status ? status[0].toUpperCase() + status.slice(1) : "",
      ownerId: s(a.owner_id),
      openOpps: a.open_opps,
    };
  });

  const deals = rawDeals.map((d) => {
    noteOwner(d.owner_id, d.owner_name);
    return {
      id: s(d.id),
      type: "deal",
      name: s(d.name) || "Untitled deal",
      stage: s(d.stage_label) || s(d.stage),
      amount: money(d.amount),
      amt: typeof d.amount === "number" ? d.amount : 0,
      closeDate: s(d.close_date),
      accountId: s(d.account_id),
      accountName: s(d.account_name),
      ownerId: s(d.owner_id),
      contactIds: Array.isArray(d.contacts) ? (d.contacts as Rec[]).map((c) => s(c.id)).filter(Boolean) : [],
      health: "",
      tasksOpen: d.tasks_open,
    };
  });

  const meetings = rawMeetings.map((m, i) => {
    noteOwner(m.owner_id, m.owner_name);
    return {
      id: s(m.id) || `mtg-${i}`,
      type: "meeting",
      name: s(m.name) || s(m.title) || s(m.subject) || "Meeting",
      date: (s(m.scheduled_at) || s(m.date) || s(m.start_time)).slice(0, 10),
      durationMin: typeof m.duration_minutes === "number" ? m.duration_minutes : typeof m.duration_min === "number" ? m.duration_min : "",
      source: s(m.source) || s(m.provider),
      accountId: s(m.account_id),
      dealId: s(m.opportunity_id) || s(m.deal_id),
      status: s(m.status),
      attendeeContactIds: [],
      ownerId: s(m.owner_id),
      summary: s(m.summary) || s(m.overview) || (m.deal && typeof m.deal === "object" ? `${s((m.deal as Rec).name)} · ${s((m.deal as Rec).stage)}` : ""),
    };
  });

  // list_tasks carries no owner; `producer` records where the task came from.
  const tasks = rawTasks.map((t, i) => {
    const deal = Array.isArray(t.associated_deal_ids) && t.associated_deal_ids.length ? s((t.associated_deal_ids as unknown[])[0]) : s(t.opportunity_id);
    return {
      id: s(t.id) || `task-${i}`,
      type: "task",
      name: s(t.subject) || s(t.name) || "Task",
      due: friendlyDate(t.due_date),
      status: s(t.status) ? s(t.status)[0].toUpperCase() + s(t.status).slice(1) : "",
      priority: s(t.priority),
      ownerId: s(t.owner_id),
      source: taskSource(t.producer),
      dealId: deal,
      note: s(t.body) || s(t.note),
    };
  });

  // Count OPEN deals per owner (exclude closed-won / closed-lost stages).
  const isOpenStage = (stage: string) => !/closed|won|lost/i.test(stage);
  for (const d of deals) {
    if (!isOpenStage(d.stage)) continue;
    const o = owners.get(d.ownerId as string);
    if (o) (o.openDeals as number)++;
  }

  return Response.json(
    { account: accounts, deal: deals, meeting: meetings, task: tasks, contact: [], owner: [...owners.values()] },
    { headers: CORS },
  );
}
