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
//
// The built-in system agents are loaded from the editable config file at
// `config/agents.json` — edit/add personas there (each carries a full,
// self-contained systemPrompt). User-created agents live in localStorage.

import { getUploads } from "./data";
import systemAgents from "@/config/agents.json";

export const SYSTEM_AGENTS = systemAgents.map((a) => ({ ...a, builtin: true }));

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

export function isSystemAgent(id) {
  return SYSTEM_AGENTS.some((a) => a.id === id);
}

// Upsert an agent into the local store. Editing a system agent (same id) saves
// an override that wins in listAgents(); deleting it reverts to the default.
// Spreads the incoming agent so display fields (tools, starter, lastRun, builtin)
// are preserved on edits.
export function saveAgent(agent) {
  const list = listUserAgents();
  const id =
    agent.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `agent-${Date.now()}`);
  const record = {
    ...agent,
    id,
    name: (agent.name || "").trim() || "Untitled agent",
    desc: (agent.desc || "").trim(),
    systemPrompt: (agent.systemPrompt || "").trim(),
    icon: agent.icon || "Spark",
    tone: agent.tone || "gold",
    tag: (agent.tag || "Custom").trim() || "Custom",
    mcpServerIds: Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : [],
    fileIds: Array.isArray(agent.fileIds) ? agent.fileIds : [],
    includeAmpup: agent.includeAmpup !== false,
  };
  const next = list.some((a) => a.id === id)
    ? list.map((a) => (a.id === id ? record : a))
    : [...list, record];
  persist(next);
  return record;
}

// Duplicate any agent (system or user) into a new editable user agent.
export function duplicateAgent(agent) {
  return saveAgent({
    ...agent,
    id: undefined,
    name: `Copy of ${agent.name || "agent"}`,
    builtin: false,
    starter: false,
    lastRun: undefined,
  });
}

export function deleteAgent(id) {
  persist(listUserAgents().filter((a) => a.id !== id));
}

// System defaults overlaid with any local overrides (by id); new user agents
// append. Order: system agents first (config order), then user-created ones.
export function listAgents() {
  const byId = new Map();
  for (const a of SYSTEM_AGENTS) byId.set(a.id, a);
  for (const a of listUserAgents()) byId.set(a.id, a);
  return [...byId.values()];
}

// Resolve an agent's attached files to the uploads the chat can inject as context.
export function agentFiles(agent) {
  if (!agent || !Array.isArray(agent.fileIds) || agent.fileIds.length === 0) return [];
  const ids = new Set(agent.fileIds);
  return getUploads().filter((f) => ids.has(f.datasourceId));
}
