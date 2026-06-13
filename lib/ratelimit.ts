// Lightweight fixed-window rate limiter for the chat hot path. There is no other
// app-level backpressure: a single user/bot can otherwise spam /api/chat, and
// each turn can fan out MAX_STEPS tool calls against the AmpUp MCP backend. This
// caps that.
//
// Backed by a Redis-over-HTTP store — works with BOTH Vercel KV and Upstash
// (identical REST API). No SDK dependency: we speak the REST pipeline directly so
// the template stays dependency-light and store-agnostic. When NO store is
// configured (single-org dev, local bench, or an operator who hasn't provisioned
// one) the limiter NO-OPS (fail-open) so nothing breaks — abuse protection is
// opt-in via env, not a hard requirement.

type RestConfig = { url: string; token: string };

// Accept either Vercel KV's env names or Upstash's; they back the same REST API.
function restConfig(): RestConfig | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

let warned = false;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetSec: number;
  limit: number;
  // True when no store is configured (the call was a no-op / fail-open).
  skipped?: boolean;
};

const RL_TIMEOUT_MS = Number(process.env.RATELIMIT_TIMEOUT_MS) || 2000;

// Fixed-window counter: INCR a per-window-bucket key, and (only when it's freshly
// created) set its TTL so the window expires. One round trip via the REST
// pipeline; EXPIRE ... NX makes the TTL idempotent so constant traffic can't keep
// pushing the expiry out.
export async function rateLimit(
  id: string,
  opts: { limit: number; windowSec: number }
): Promise<RateLimitResult> {
  const cfg = restConfig();
  const { limit, windowSec } = opts;
  if (!cfg) {
    if (!warned) {
      warned = true;
      console.warn(
        "[gtm] rate limiting disabled: set KV_REST_API_URL/TOKEN (Vercel KV) or " +
          "UPSTASH_REDIS_REST_URL/TOKEN (Upstash) to enable per-user/IP limits on /api/chat."
      );
    }
    return { ok: true, remaining: limit, resetSec: 0, limit, skipped: true };
  }

  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${id}:${bucket}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), RL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${cfg.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(windowSec), "NX"],
        ]),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // Store reachable but erroring: fail OPEN (availability over strictness),
      // but make it visible.
      console.error(`[gtm] rate limit store ${res.status}; allowing request`);
      return { ok: true, remaining: limit, resetSec: windowSec, limit, skipped: true };
    }
    const out = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(out?.[0]?.result ?? 0);
    const remaining = Math.max(0, limit - count);
    const resetSec = (bucket + 1) * windowSec - Math.floor(Date.now() / 1000);
    return { ok: count <= limit, remaining, resetSec, limit };
  } catch (err) {
    // Network/timeout to the store: fail open so a store blip can't take chat down.
    console.error("[gtm] rate limit check failed; allowing request:", err);
    return { ok: true, remaining: limit, resetSec: windowSec, limit, skipped: true };
  }
}

// Client IP from the standard proxy headers Vercel/Next set. Falls back to a
// constant so a missing header degrades to a single shared bucket rather than
// throwing (better to over-limit unknowns than to crash).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
