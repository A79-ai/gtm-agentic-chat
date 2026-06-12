// In-memory activity log of every /api call the app makes through apiFetch.
// A bounded ring buffer (newest-first) with a useSyncExternalStore-friendly
// subscribe/getSnapshot pair. We record only method, path, status, duration and
// timestamp: never request or response bodies (privacy).

const MAX = 100;

// Internal polling calls would dominate a 100-entry buffer and evict real
// activity within minutes, so they are excluded from the log.
const SILENT = new Set(["/api/onboarding/sync-status"]);

let entries = []; // newest-first; replaced (never mutated) so the snapshot ref is stable
const listeners = new Set();
let seq = 0;

function emit() {
  for (const l of listeners) {
    l();
  }
}

// friendly label for a path (fall back to the raw path)
const LABELS = [
  [/^\/api\/records/, "Loaded records"],
  [/^\/api\/counts/, "Counted records"],
  [/^\/api\/connectors/, "Loaded connectors"],
  [/^\/api\/chat/, "Chat turn"],
  [/^\/api\/create/, "Created record"],
  [/^\/api\/search/, "Searched"],
  [/^\/api\/list/, "Listed records"],
  [/^\/api\/me/, "Loaded profile"],
  [/^\/api\/upload/, "Uploaded file"],
  [/^\/api\/onboarding-seed/, "Seeded workspace"],
  [/^\/api\/installations/, "Connected integration"],
  [/^\/api\/notetaker/, "Notetaker"],
  [/^\/api\/meeting-brief/, "Meeting brief"],
  [/^\/api\/conversation/, "Conversation"],
];
export function labelForPath(path) {
  const clean = (path || "").split("?")[0];
  for (const [re, label] of LABELS) {
    if (re.test(clean)) {
      return label;
    }
  }
  return clean || "API call";
}

// Record one call. Never throws (callers fire this in a finally).
export function recordActivity({ method, path, status, ms }) {
  try {
    const clean = (path || "").split("?")[0];
    if (SILENT.has(clean)) {
      return;
    }
    const entry = {
      id: `a${++seq}`,
      method: (method || "GET").toUpperCase(),
      path: clean,
      status: typeof status === "number" ? status : 0,
      ms: Math.max(0, Math.round(ms || 0)),
      ts: Date.now(),
    };
    entries = [entry, ...entries].slice(0, MAX);
    emit();
  } catch {
    // Logging is best-effort and must never break a real API call.
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable reference between mutations so useSyncExternalStore doesn't loop.
export function getSnapshot() {
  return entries;
}

// Server render has no client-side history.
const EMPTY = [];
export function getServerSnapshot() {
  return EMPTY;
}

// Relative "time ago" label for an entry timestamp.
export function relTime(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) {
    return "just now";
  }
  if (s < 60) {
    return `${s}s ago`;
  }
  const m = Math.round(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.round(m / 60);
  if (h < 24) {
    return `${h}h ago`;
  }
  return `${Math.round(h / 24)}d ago`;
}
