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
