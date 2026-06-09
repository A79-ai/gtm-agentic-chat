// Client-side registry of user-added MCP servers. Thin-client model: there's no
// backend store, so servers (incl. their token) live in localStorage and are
// threaded to /api/chat per request at conversation start. The token never
// enters the build — it's user-entered and stays in the browser / request body.
//
// The built-in "ampup" server is implicit (env-configured server-side) and is
// NOT part of this registry; "ampup" is a reserved slug.

import CATALOG from "@/config/mcp-catalog.json";

const KEY = "ampup-mcp-servers";

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Canonical, stable slug for a server. When it matches a catalog entry (by URL
// or name) use the catalog's slug, so homepage agents can reliably target it via
// mcpServerIds no matter how the user typed the name. Returns null for ad-hoc
// (non-catalog) servers, which fall back to slugify(name).
const normUrl = (u) => String(u || "").trim().replace(/\/+$/, "").toLowerCase();
function catalogSlug(server) {
  const url = normUrl(server.url);
  const name = String(server.name || "").trim().toLowerCase();
  const hit = CATALOG.find(
    (c) => (url && normUrl(c.url) === url) || (name && c.name.toLowerCase() === name),
  );
  return hit ? hit.slug : null;
}

export function listMcpServers() {
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
    // ignore quota / availability errors — registry is best-effort
  }
  return list;
}

function uniqueSlug(base, existing, selfId) {
  let slug = base || "server";
  if (slug === "ampup") slug = "ampup-mcp";
  const taken = new Set(existing.filter((s) => s.id !== selfId).map((s) => s.slug));
  let candidate = slug;
  let n = 2;
  while (taken.has(candidate)) candidate = `${slug}-${n++}`;
  return candidate;
}

// Upsert a server. `server` = { id?, name, url, token?, authHeader?, enabled? }.
// Returns the saved record (with a stable id + unique slug).
export function saveMcpServer(server) {
  const list = listMcpServers();
  const id =
    server.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `mcp-${Date.now()}`);
  const record = {
    id,
    name: (server.name || "").trim() || "MCP server",
    url: (server.url || "").trim(),
    token: (server.token || "").trim(),
    authHeader: (server.authHeader || "").trim(),
    enabled: server.enabled !== false,
    slug: uniqueSlug(server.slug || catalogSlug(server) || slugify(server.name), list, id),
    // OAuth-connected servers carry the metadata needed to refresh the token.
    oauth: server.oauth || null,
  };
  const next = list.some((s) => s.id === id)
    ? list.map((s) => (s.id === id ? record : s))
    : [...list, record];
  persist(next);
  return record;
}

export function deleteMcpServer(id) {
  persist(listMcpServers().filter((s) => s.id !== id));
}

export function setMcpServerEnabled(id, enabled) {
  persist(listMcpServers().map((s) => (s.id === id ? { ...s, enabled } : s)));
}

// Servers to thread into a chat request (enabled only, minimal shape).
export function enabledMcpServers() {
  return listMcpServers()
    .filter((s) => s.enabled !== false && s.url)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      url: s.url,
      token: s.token || undefined,
      authHeader: s.authHeader || undefined,
    }));
}

// Refresh OAuth access tokens that are expired / near expiry, persisting the new
// tokens back to the registry. Called when a chat opens so the agent starts the
// conversation with a fresh token. (A very long single session past token
// expiry should be reopened — per-turn refresh is a follow-up.)
export async function refreshOauthServers() {
  const list = listMcpServers();
  const SKEW = 120_000; // refresh if expiring within 2 min
  let changed = false;
  for (const s of list) {
    const o = s.oauth;
    if (!o || !o.refreshToken || !o.asUrl) continue;
    if (o.expiresAt && o.expiresAt - Date.now() > SKEW) continue;
    try {
      const res = await fetch("/api/mcp/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asUrl: o.asUrl,
          resource: o.resource,
          refreshToken: o.refreshToken,
          clientInformation: o.clientInformation,
        }),
      }).then((r) => r.json());
      if (res.ok && res.access_token) {
        s.token = res.access_token;
        s.oauth = { ...o, refreshToken: res.refresh_token || o.refreshToken, expiresAt: res.expires_at };
        changed = true;
      }
    } catch {
      // best-effort: leave the existing token; the call may still work or 401
    }
  }
  if (changed) persist(list);
}
