// Shared CRM record normalization — maps raw MCP list-tool items to the flat
// shapes the UI renders. Used by /api/records (bulk load) and /api/list
// (server-side pagination) so the two never drift.
export type Rec = Record<string, unknown>;

export const s = (v: unknown): string => (v == null ? "" : String(v));

// Render a CRM date/timestamp as a short, human date (e.g. "Apr 30, 2025").
export function friendlyDate(v: unknown): string {
  const str = s(v);
  if (!str) return "";
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function money(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!v || Number.isNaN(v)) return "";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

// Tasks carry no owner; `producer` records where the task came from.
export function taskSource(producer: unknown): string {
  const p = s(producer).toLowerCase();
  if (!p) return "";
  if (p.includes("chat")) return "Chat";
  if (p.includes("crm")) return "CRM";
  if (p.includes("agent")) return "Agent";
  if (p.includes("meeting")) return "Meeting";
  return s(producer).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// List tools may wrap the row (e.g. { task: {...} }) — unwrap it.
export function unwrap(r: Rec): Rec {
  return r && typeof r === "object" && "task" in r ? (r.task as Rec) : r;
}

export const NORMALIZE: Record<string, (r: Rec, i: number) => Rec> = {
  account: (a) => ({
    id: s(a.id), type: "account", name: s(a.name) || "Untitled account",
    industry: s(a.industry), size: "", location: "", arr: money(a.total_pipeline),
    health: s(a.status) ? s(a.status)[0].toUpperCase() + s(a.status).slice(1) : "",
    ownerId: s(a.owner_id), openOpps: a.open_opps,
  }),
  deal: (d) => ({
    id: s(d.id), type: "deal", name: s(d.name) || "Untitled deal",
    stage: s(d.stage_label) || s(d.stage), amount: money(d.amount),
    amt: typeof d.amount === "number" ? d.amount : 0, closeDate: s(d.close_date),
    accountId: s(d.account_id), accountName: s(d.account_name), ownerId: s(d.owner_id),
    contactIds: Array.isArray(d.contacts) ? (d.contacts as Rec[]).map((c) => s(c.id)).filter(Boolean) : [],
    health: "", tasksOpen: d.tasks_open,
  }),
  meeting: (m, i) => ({
    id: s(m.id) || `mtg-${i}`, type: "meeting",
    name: s(m.name) || s(m.title) || s(m.subject) || "Meeting",
    date: (s(m.scheduled_at) || s(m.date) || s(m.start_time)).slice(0, 10),
    durationMin: typeof m.duration_minutes === "number" ? m.duration_minutes : typeof m.duration_min === "number" ? m.duration_min : "",
    source: s(m.source) || s(m.provider), accountId: s(m.account_id),
    dealId: s(m.opportunity_id) || s(m.deal_id), status: s(m.status),
    attendeeContactIds: [], ownerId: s(m.owner_id),
    summary: s(m.summary) || s(m.overview) || (m.deal && typeof m.deal === "object" ? `${s((m.deal as Rec).name)} · ${s((m.deal as Rec).stage)}` : ""),
  }),
  task: (t, i) => ({
    id: s(t.id) || `task-${i}`, type: "task", name: s(t.subject) || s(t.name) || "Task",
    due: friendlyDate(t.due_date), status: s(t.status) ? s(t.status)[0].toUpperCase() + s(t.status).slice(1) : "",
    priority: s(t.priority), ownerId: s(t.owner_id), source: taskSource(t.producer),
    dealId: Array.isArray(t.associated_deal_ids) && t.associated_deal_ids.length ? s((t.associated_deal_ids as unknown[])[0]) : s(t.opportunity_id),
    note: s(t.body) || s(t.note),
  }),
  contact: (c, i) => ({
    id: s(c.id) || `contact-${i}`, type: "contact",
    name: s(c.name) || [s(c.first_name), s(c.last_name)].filter(Boolean).join(" ") || s(c.email) || "Contact",
    title: s(c.title), accountId: s(c.account_id), accountName: s(c.company) || s(c.account_name),
    email: s(c.email), phone: s(c.phone_number) || s(c.phone), ownerId: s(c.owner_id),
  }),
};

// The MCP list tool per UI entity type + the array key its rows live under.
export const LIST_TOOL: Record<string, { tool: string; args?: Rec }> = {
  account: { tool: "list_accounts" },
  deal: { tool: "list_opportunities" },
  meeting: { tool: "list_meetings", args: { only_my_meetings: false } },
  task: { tool: "list_tasks" },
  contact: { tool: "list_contacts" },
};

// Pull { items, total } out of a parsed MCP list response.
export function pageOf(parsed: unknown): { items: Rec[]; total: number | null } {
  if (Array.isArray(parsed)) return { items: parsed as Rec[], total: parsed.length };
  if (parsed && typeof parsed === "object") {
    const o = parsed as Rec;
    let items: Rec[] = [];
    for (const k of ["items", "results", "opportunities", "deals", "accounts", "tasks", "meetings", "contacts"]) {
      if (Array.isArray(o[k])) { items = o[k] as Rec[]; break; }
    }
    const total = typeof o.total === "number" ? o.total : typeof o.count === "number" ? (o.count as number) : null;
    return { items, total };
  }
  return { items: [], total: 0 };
}
