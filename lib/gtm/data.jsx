// CRM data model — static metadata + a live record store fed by /api/records.
// Components read the synchronous DATA singleton; <DataProvider> populates the
// store on mount and forces a re-render so reads pick up real records.
import { createContext, useContext, useEffect, useState } from "react";
import { AUTH0_ENABLED, apiFetch, useMcpKeyContext } from "@/lib/gtm/auth";

// ---- Connectors catalog (connection state is presentational) ----
export const CONNECTORS = [
  {
    id: "hubspot",
    name: "HubSpot",
    logo: "HubSpot",
    cat: "CRM",
    connected: true,
    desc: "Sync companies, deals, contacts and pipeline stages.",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: "Salesforce",
    cat: "CRM",
    connected: false,
    desc: "Sync accounts, opportunities, leads and activities.",
  },
  {
    id: "dynamics",
    name: "Dynamics CRM",
    logo: "Dynamics",
    cat: "CRM",
    connected: false,
    desc: "Sync accounts, opportunities and contacts from Microsoft.",
  },
  {
    id: "gong",
    name: "Gong",
    logo: "Gong",
    cat: "Call Recording",
    connected: true,
    desc: "Pull call recordings, transcripts and deal signals.",
  },
  {
    id: "fireflies",
    name: "Fireflies",
    logo: "Fireflies",
    cat: "Call Recording",
    connected: true,
    desc: "Pull meeting transcripts, summaries and analytics.",
  },
  {
    id: "fathom",
    name: "Fathom",
    logo: "Fathom",
    cat: "Call Recording",
    connected: false,
    desc: "Pull meeting recordings, transcripts and highlights.",
  },
  {
    id: "clari",
    name: "Clari Copilot",
    logo: "Clari",
    cat: "Call Recording",
    connected: false,
    desc: "Pull conversation intelligence from Clari Copilot.",
  },
  {
    id: "granola",
    name: "Granola",
    logo: "Granola",
    cat: "Call Recording",
    connected: true,
    desc: "Pull meeting notes and transcripts from your meetings.",
  },
  {
    id: "slack",
    name: "Slack",
    logo: "Slack",
    cat: "Notification",
    connected: false,
    desc: "Send deal summaries and agent notifications to channels.",
  },
  {
    id: "devrev",
    name: "DevRev",
    logo: "DevRev",
    cat: "MCP",
    connected: false,
    desc: "Pull conversations, tickets, accounts and product signals.",
  },
];
export const CAT_TABS = ["All", "CRM", "Call Recording", "Calendar", "Notification", "MCP"];

export const ENTITIES = {
  deal: { type: "deal", label: "Deal", plural: "Deals", icon: "Dollar", tone: "gold" },
  account: {
    type: "account",
    label: "Account",
    plural: "Accounts",
    icon: "Building",
    tone: "teal",
  },
  contact: { type: "contact", label: "Contact", plural: "Contacts", icon: "User", tone: "mint" },
  meeting: {
    type: "meeting",
    label: "Meeting",
    plural: "Meetings",
    icon: "Calendar",
    tone: "teal",
  },
  task: { type: "task", label: "Task", plural: "Tasks", icon: "CheckSquare", tone: "gold" },
  owner: { type: "owner", label: "Owner", plural: "Owners", icon: "Users", tone: "mint" },
};
export const ENTITY_ORDER = ["deal", "account", "contact", "meeting", "task", "owner"];

export const AGENTS = [
  {
    id: "deal-coach",
    name: "Deal Coach",
    icon: "Target",
    tone: "gold",
    tag: "Pipeline",
    lastRun: "2h ago",
    starter: true,
    desc: "Chat with any deal. Pulls CRM, calls and notes to surface risks, momentum and the next best action.",
    tools: ["hubspot", "gong", "granola"],
  },
  {
    id: "call-digest",
    name: "Call Digest",
    icon: "Phone",
    tone: "teal",
    tag: "Calls",
    lastRun: "20m ago",
    starter: true,
    desc: "Summarize any call, extract commitments and objections, and draft the follow-up in seconds.",
    tools: ["gong", "fireflies"],
  },
  {
    id: "outreach",
    name: "Outreach Writer",
    icon: "Mail",
    tone: "mint",
    tag: "Prospecting",
    lastRun: "1d ago",
    starter: true,
    desc: "Draft personalized sequences grounded in real account research and recent conversations.",
    tools: ["hubspot", "slack"],
  },
  {
    id: "account-research",
    name: "Account Researcher",
    icon: "Building",
    tone: "gold",
    tag: "Research",
    lastRun: "3h ago",
    starter: false,
    desc: "Build a one-page brief on any account — org chart, signals, whitespace and warm paths in.",
    tools: ["hubspot", "devrev"],
  },
  {
    id: "pipeline-risk",
    name: "Pipeline Risk Scanner",
    icon: "Activity",
    tone: "teal",
    tag: "Pipeline",
    lastRun: "5h ago",
    starter: false,
    desc: "Scan the whole book for deals slipping past their kickoff window and explain why.",
    tools: ["hubspot", "gong"],
  },
  {
    id: "meeting-prep",
    name: "Meeting Prep",
    icon: "Calendar",
    tone: "mint",
    tag: "Calls",
    lastRun: "Yesterday",
    starter: false,
    desc: "Walk into every call ready — agenda, attendee context and the last three touchpoints.",
    tools: ["granola", "hubspot"],
  },
];

export const FIELDS = {
  deal: [
    ["Stage", "stage", "badge"],
    ["Amount", "amount"],
    ["Close date", "closeDate"],
    ["Account", "accountName"],
    ["Owner", "ownerId", "ref"],
  ],
  account: [
    ["Industry", "industry"],
    ["Pipeline", "arr"],
    ["Open opps", "openOpps"],
    ["Health", "health", "badge"],
    ["Owner", "ownerId", "ref"],
  ],
  contact: [
    ["Title", "title"],
    ["Account", "accountId", "ref"],
    ["Email", "email"],
    ["Phone", "phone"],
    ["Owner", "ownerId", "ref"],
  ],
  meeting: [
    ["Date", "date"],
    ["Duration", "durationMin", "min"],
    ["Source", "source"],
    ["Account", "accountId", "ref"],
    ["Deal", "dealId", "ref"],
  ],
  task: [
    ["Status", "status", "badge"],
    ["Due", "due"],
    ["Priority", "priority", "badge"],
    ["Source", "source"],
    ["Deal", "dealId", "ref"],
  ],
  owner: [
    ["Role", "role"],
    ["Region", "region"],
    ["Email", "email"],
    ["Open deals", "openDeals"],
  ],
};

export const COLUMNS = {
  deal: [
    ["name", "Deal", "title"],
    ["stage", "Stage", "badge"],
    ["amount", "Amount", "text"],
    ["accountName", "Account", "text"],
    ["ownerId", "Owner", "avatar"],
  ],
  account: [
    ["name", "Account", "title"],
    ["industry", "Industry", "text"],
    ["arr", "Pipeline", "text"],
    ["health", "Health", "badge"],
    ["ownerId", "Owner", "avatar"],
  ],
  contact: [
    ["name", "Contact", "avatarTitle"],
    ["title", "Title", "text"],
    ["accountId", "Account", "ref"],
    ["email", "Email", "text"],
  ],
  meeting: [
    ["name", "Meeting", "title"],
    ["date", "Date", "text"],
    ["source", "Source", "text"],
    ["accountId", "Account", "ref"],
    ["durationMin", "Length", "min"],
  ],
  task: [
    ["name", "Task", "title"],
    ["status", "Status", "badge"],
    ["due", "Due", "text"],
    ["priority", "Priority", "badge"],
    ["source", "Source", "text"],
  ],
  owner: [
    ["name", "Owner", "avatarTitle"],
    ["role", "Role", "text"],
    ["openDeals", "Open deals", "text"],
  ],
};

export const SUGGESTIONS = {
  deal: [
    "How is this deal progressing?",
    "What were the takeaways from the last meeting?",
    "What risks should I be aware of?",
    "Draft a follow-up email",
  ],
  account: [
    "Summarize this account",
    "What's the whitespace here?",
    "Who are the key stakeholders?",
    "Draft an executive intro",
  ],
  contact: [
    "Brief me on this person",
    "What's our relationship history?",
    "Draft an outreach message",
  ],
  meeting: ["Summarize this meeting", "What did they commit to?", "Draft the follow-up"],
  task: ["What do I need to do here?", "Draft the work for this task"],
  owner: ["How is this rep tracking?", "Which deals need attention?"],
  none: [
    "What needs my attention today?",
    "Which deals are at risk?",
    "Summarize my pipeline",
    "What meetings happened this week?",
  ],
};

export function healthTone(v) {
  if (/risk|overdue|stalled|lost/i.test(v)) {
    return "danger";
  }
  if (/healthy|expanding|done|win|completed|closed won/i.test(v)) {
    return "success";
  }
  return "neutral";
}

export function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---- Live record store (populated by the API) ----
const STORE = { deal: [], account: [], contact: [], meeting: [], task: [], owner: [] };
let ALL = [];
function reindex() {
  ALL = ENTITY_ORDER.flatMap((t) => STORE[t] || []);
}

export function setRecords(data) {
  for (const t of ENTITY_ORDER) {
    STORE[t] = Array.isArray(data?.[t]) ? data[t] : [];
  }
  reindex();
}

// ---- Live connectors (real integration catalog + connected state) ----
let CONNECTOR_STORE = [];
let AMPERSAND = { configured: false, projectId: "", apiKey: "", groupRef: "", consumerRef: "" };
export function setConnectors(payload) {
  CONNECTOR_STORE = Array.isArray(payload?.connectors) ? payload.connectors : [];
  AMPERSAND = {
    ...(payload?.ampersand || {}),
    groupRef: payload?.groupRef || "",
    consumerRef: payload?.consumerRef || "",
  };
}
export const getConnectors = () => (CONNECTOR_STORE.length ? CONNECTOR_STORE : CONNECTORS);
export const getAmpersand = () => AMPERSAND;

// ---- Live totals (accurate per-type counts from /api/counts) ----
// Falls back to the (capped) loaded store length until the totals arrive.
let COUNTS = {};
export function setCounts(counts) {
  COUNTS = counts && typeof counts === "object" ? counts : {};
}
export const countOf = (type) =>
  typeof COUNTS[type] === "number" ? COUNTS[type] : (STORE[type] || []).length;

// ---- Uploaded files (session-scoped; no global datasource-list MCP tool, so
// the Files surface lists what was uploaded from this client, persisted locally). ----
const UPLOADS_KEY = "ampup-uploads";
export function getUploads() {
  try {
    const v = JSON.parse(localStorage.getItem(UPLOADS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function addUpload(file) {
  const list = getUploads().filter((f) => f.datasourceId !== file.datasourceId);
  list.unshift(file);
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}
  return list;
}

// ---- Chat history (session-scoped; the durable run holds the server-side
// transcript, but listing/reopening past chats is a per-browser concern, so we
// persist the full client message array locally and rehydrate on reopen). ----
const CONVOS_KEY = "ampup-conversations";
const CONVOS_MAX = 50;
const partsText = (m) =>
  (m.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();

export function listConversations() {
  try {
    const v = JSON.parse(localStorage.getItem(CONVOS_KEY) || "[]");
    return Array.isArray(v)
      ? v.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      : [];
  } catch {
    return [];
  }
}
export function getConversation(id) {
  return listConversations().find((c) => c.id === id) || null;
}
export function saveConversation({ id, runId, messages }) {
  if (!(id && Array.isArray(messages)) || messages.length === 0) {
    return;
  }
  const firstUser = messages.find((m) => m.role === "user");
  const last = messages[messages.length - 1];
  const title = (firstUser ? partsText(firstUser) : "New chat").slice(0, 80) || "New chat";
  const preview = (last ? partsText(last) : "").slice(0, 120);
  let list;
  try {
    list = listConversations().filter((c) => c.id !== id);
  } catch {
    list = [];
  }
  list.unshift({
    id,
    runId,
    title,
    preview,
    messageCount: messages.length,
    updatedAt: Date.now(),
    messages,
  });
  try {
    localStorage.setItem(CONVOS_KEY, JSON.stringify(list.slice(0, CONVOS_MAX)));
  } catch {
    // Likely quota: drop the heavy message bodies from older entries and retry once.
    const trimmed = list.slice(0, CONVOS_MAX).map((c, i) => (i === 0 ? c : { ...c, messages: [] }));
    try {
      localStorage.setItem(CONVOS_KEY, JSON.stringify(trimmed));
    } catch {}
  }
}
export function deleteConversation(id) {
  try {
    localStorage.setItem(
      CONVOS_KEY,
      JSON.stringify(listConversations().filter((c) => c.id !== id))
    );
  } catch {}
}

export const recordsOf = (type) => STORE[type] || [];
export const byId = (id) => ALL.find((r) => r.id === id);
export const titleOf = (r) => r.name;

export function subtitleOf(r) {
  if (!r) {
    return "";
  }
  switch (r.type) {
    case "deal":
      return [r.stage, r.amount].filter(Boolean).join(" · ");
    case "account":
      return [r.industry, r.arr && `${r.arr} pipeline`].filter(Boolean).join(" · ");
    case "contact": {
      const a = byId(r.accountId);
      return [r.title, a && a.name].filter(Boolean).join(" · ");
    }
    case "meeting":
      return [r.date, r.durationMin && `${r.durationMin} min`].filter(Boolean).join(" · ");
    case "task":
      return [r.status, r.due && `due ${r.due}`].filter(Boolean).join(" · ");
    case "owner":
      return [r.role, r.region].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

export function related(r) {
  const out = {};
  const push = (k, rec) => {
    if (rec) {
      out[k] = out[k] || [];
      out[k].push(rec);
    }
  };
  if (r.type === "deal") {
    push("account", byId(r.accountId));
    push("owner", byId(r.ownerId));
    (r.contactIds || []).forEach((id) => push("contact", byId(id)));
    STORE.meeting.filter((m) => m.dealId === r.id).forEach((m) => push("meeting", m));
    STORE.task.filter((t) => t.dealId === r.id).forEach((t) => push("task", t));
  } else if (r.type === "account") {
    push("owner", byId(r.ownerId));
    STORE.deal.filter((d) => d.accountId === r.id).forEach((d) => push("deal", d));
    STORE.contact.filter((c) => c.accountId === r.id).forEach((c) => push("contact", c));
    STORE.meeting.filter((m) => m.accountId === r.id).forEach((m) => push("meeting", m));
  } else if (r.type === "contact") {
    push("account", byId(r.accountId));
    push("owner", byId(r.ownerId));
  } else if (r.type === "meeting") {
    push("account", byId(r.accountId));
    push("deal", byId(r.dealId));
    push("owner", byId(r.ownerId));
  } else if (r.type === "task") {
    push("owner", byId(r.ownerId));
    push("deal", byId(r.dealId));
  } else if (r.type === "owner") {
    STORE.deal.filter((d) => d.ownerId === r.id).forEach((d) => push("deal", d));
    STORE.account.filter((a) => a.ownerId === r.id).forEach((a) => push("account", a));
    STORE.task.filter((t) => t.ownerId === r.id).forEach((t) => push("task", t));
  }
  return out;
}

export function searchAll(q) {
  q = (q || "").toLowerCase().trim();
  if (!q) {
    return ALL;
  }
  return ALL.filter(
    (r) => (r.name || "").toLowerCase().includes(q) || subtitleOf(r).toLowerCase().includes(q)
  );
}

export const DATA = {
  CONNECTORS,
  CAT_TABS,
  ENTITIES,
  ENTITY_ORDER,
  FIELDS,
  COLUMNS,
  SUGGESTIONS,
  AGENTS,
  byId,
  recordsOf,
  titleOf,
  subtitleOf,
  initials,
  related,
  searchAll,
  healthTone,
};

// ---- Provider: fetch records on mount, re-render subtree when ready ----
const DataCtx = createContext({ ready: false, error: null });
export const useDataStatus = () => useContext(DataCtx);

export function DataProvider({ children }) {
  const [state, setState] = useState({ ready: false, error: null, version: 0 });
  const { key } = useMcpKeyContext();
  useEffect(() => {
    // In multi-tenant mode wait for the per-user key before fetching; single-org
    // dev fetches immediately and falls back to the server env key.
    if (AUTH0_ENABLED && !key) {
      return;
    }
    let alive = true;
    const records = apiFetch("/api/records")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`records ${r.status}`))))
      .then((data) => {
        if (alive) {
          setRecords(data);
        }
      });
    const connectors = apiFetch("/api/connectors")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setConnectors(data);
        }
      })
      .catch(() => {});
    const counts = apiFetch("/api/counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setCounts(data.counts);
        }
      })
      .catch(() => {});
    Promise.allSettled([records, connectors, counts]).then(() => {
      if (alive) {
        setState((s) => ({ ...s, ready: true, error: null }));
      }
    });
    return () => {
      alive = false;
    };
  }, [key]);
  // Re-pull records + counts after a mutation; bump version to force a re-render.
  const refresh = () =>
    Promise.allSettled([
      apiFetch("/api/records")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setRecords(data);
          }
        }),
      apiFetch("/api/counts")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setCounts(data.counts);
          }
        }),
    ])
      .then(() => setState((s) => ({ ...s, version: s.version + 1 })))
      .catch(() => {});
  return <DataCtx.Provider value={{ ...state, refresh }}>{children}</DataCtx.Provider>;
}
