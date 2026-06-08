// Agent definitions. An agent bundles a system prompt + a scoped set of MCP
// servers + (optional) attached files into a reusable chat persona.
//
// Two tiers:
//   - System agents: the built-in homepage personas, with real prompts. They
//     run on the built-in ampup CRM (includeAmpup) and are read-only.
//   - User agents: created in the agent builder, stored in localStorage. They
//     can scope to any custom MCP servers (by slug) and attach uploaded files.
//
// Scoping is server-level (the advisor's guidance): an agent's server subset
// becomes the chat's start-time server set. `includeAmpup` keeps the core CRM
// available (default true); a pure-custom-MCP agent can turn it off.

import { getUploads } from "./data";

const BASE = `You have live tools for the organization's data. When a question is about the org's data, call a tool rather than guessing. Prefer listing/searching to find the right entity, then fetch its detail. Be concise and specific, citing concrete records (names, amounts, dates). If a tool returns nothing or errors, say so plainly instead of inventing data.`;

export const SYSTEM_AGENTS = [
  {
    id: "deal-coach", name: "Deal Coach", icon: "Target", tone: "gold", tag: "Pipeline",
    lastRun: "2h ago", starter: true, builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["hubspot", "gong", "granola"],
    desc: "Chat with any deal. Pulls CRM, calls and notes to surface risks, momentum and the next best action.",
    systemPrompt: `You are a deal coach for a sales rep. Given a deal, pull its CRM record, recent meetings/calls and notes, then assess momentum, risks and the single next best action. Lead with the verdict (on-track / at-risk / stalled) and back it with concrete evidence from the data.\n\n${BASE}`,
  },
  {
    id: "call-digest", name: "Call Digest", icon: "Phone", tone: "teal", tag: "Calls",
    lastRun: "20m ago", starter: true, builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["gong", "fireflies"],
    desc: "Summarize any call, extract commitments and objections, and draft the follow-up in seconds.",
    systemPrompt: `You summarize sales calls. Pull the meeting transcript/summary, then produce: a 3-bullet recap, explicit commitments (who owes what by when), objections raised, and a ready-to-send follow-up email. Quote the call where it matters.\n\n${BASE}`,
  },
  {
    id: "outreach", name: "Outreach Writer", icon: "Mail", tone: "mint", tag: "Prospecting",
    lastRun: "1d ago", starter: true, builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["hubspot", "slack"],
    desc: "Draft personalized sequences grounded in real account research and recent conversations.",
    systemPrompt: `You write outbound sequences. Ground every message in real account research and recent conversations from the CRM. Personalize on specifics (role, recent activity, prior touches), keep it short and human, and avoid generic filler. Output a 3-step sequence unless asked otherwise.\n\n${BASE}`,
  },
  {
    id: "account-research", name: "Account Researcher", icon: "Building", tone: "gold", tag: "Research",
    lastRun: "3h ago", builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["hubspot", "devrev"],
    desc: "Build a one-page brief on any account — org chart, signals, whitespace and warm paths in.",
    systemPrompt: `You build a one-page account brief. Pull the account, its contacts, open deals and recent activity, then synthesize: who they are, key stakeholders, current footprint, whitespace, and warm paths in. Be factual and cite the records you used.\n\n${BASE}`,
  },
  {
    id: "pipeline-risk", name: "Pipeline Risk Scanner", icon: "Activity", tone: "teal", tag: "Pipeline",
    lastRun: "5h ago", builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["hubspot", "gong"],
    desc: "Scan the whole book for deals slipping past their kickoff window and explain why.",
    systemPrompt: `You scan a rep's pipeline for risk. List open deals, flag the ones slipping (no recent activity, past close date, stalled stage) and explain why for each, ordered by amount at risk. End with the top 3 to act on today.\n\n${BASE}`,
  },
  {
    id: "meeting-prep", name: "Meeting Prep", icon: "Calendar", tone: "mint", tag: "Calls",
    lastRun: "Yesterday", builtin: true, includeAmpup: true, mcpServerIds: [], fileIds: [],
    tools: ["granola", "hubspot"],
    desc: "Walk into every call ready — agenda, attendee context and the last three touchpoints.",
    systemPrompt: `You prep a rep for an upcoming meeting. Pull the related account/deal, attendees and the last few touchpoints, then produce: a suggested agenda, per-attendee context, open items from last time, and 2-3 smart questions to ask.\n\n${BASE}`,
  },
];

const KEY = "ampup-agents";

export function listUserAgents() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // best-effort; localStorage may be unavailable / over quota
  }
  return list;
}

// Upsert a user agent. Returns the saved record (with a stable id).
export function saveAgent(agent) {
  const list = listUserAgents();
  const id =
    agent.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `agent-${Date.now()}`);
  const record = {
    id,
    name: (agent.name || "").trim() || "Untitled agent",
    desc: (agent.desc || "").trim(),
    systemPrompt: (agent.systemPrompt || "").trim(),
    icon: agent.icon || "Spark",
    tone: agent.tone || "gold",
    tag: agent.tag || "Custom",
    mcpServerIds: Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : [],
    fileIds: Array.isArray(agent.fileIds) ? agent.fileIds : [],
    includeAmpup: agent.includeAmpup !== false,
    enterprise: !!agent.enterprise,
    builtin: false,
    tools: [],
  };
  const next = list.some((a) => a.id === id)
    ? list.map((a) => (a.id === id ? record : a))
    : [...list, record];
  persist(next);
  return record;
}

export function deleteAgent(id) {
  persist(listUserAgents().filter((a) => a.id !== id));
}

export function listAgents() {
  return [...SYSTEM_AGENTS, ...listUserAgents()];
}

// Resolve an agent's attached files to the uploads the chat can inject as context.
export function agentFiles(agent) {
  if (!agent || !Array.isArray(agent.fileIds) || agent.fileIds.length === 0) return [];
  const ids = new Set(agent.fileIds);
  return getUploads().filter((f) => ids.has(f.datasourceId));
}
