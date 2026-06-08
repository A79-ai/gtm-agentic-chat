// Client-side registry of user-added MCP servers. Thin-client model: there's no
// backend store, so servers (incl. their token) live in localStorage and are
// threaded to /api/chat per request at conversation start. The token never
// enters the build — it's user-entered and stays in the browser / request body.
//
// The built-in "ampup" server is implicit (env-configured server-side) and is
// NOT part of this registry; "ampup" is a reserved slug.

const KEY = "ampup-mcp-servers";

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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
    slug: uniqueSlug(slugify(server.name || server.slug), list, id),
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
