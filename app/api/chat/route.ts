import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import {
  classifyEntitlement,
  type Entitlement,
  gateDecision,
  needsLegacyStripeCheck,
} from "@/lib/entitlement";
import { isProEmail } from "@/lib/gtm/pro";
import type { LlmOpts } from "@/lib/model";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isBlockedUrl } from "@/lib/ssrf";
import { customerStatus, getStripe } from "@/lib/stripe";
import { conversationWorkflow, turnHook } from "@/workflows/chat";

export const maxDuration = 300;

// Deployment-config sanity check (logged once per cold start): if Auth0 is
// configured client-side but MULTI_TENANT isn't on, the data routes silently
// fall back to the shared AMPUP_MCP_API_KEY, i.e. per-user scoping is bypassed.
if (process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID && process.env.MULTI_TENANT !== "true") {
  console.warn(
    "[gtm] NEXT_PUBLIC_AUTH0_CLIENT_ID is set but MULTI_TENANT!=true; data routes " +
      "will fall back to the shared AMPUP_MCP_API_KEY (per-user scoping bypassed). " +
      "Set MULTI_TENANT=true for multi-tenant deployments."
  );
}

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN;
const CORS = {
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, x-ampup-mcp-key, authorization, x-workflow-run-id, x-llm-provider, x-llm-key, x-llm-model",
  "Access-Control-Expose-Headers": "x-workflow-run-id",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function apiBase(): string {
  return (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
}

// Bound the per-turn AmpUp calls. /user/me now runs on EVERY turn and the
// increment is awaited before the stream returns, so a hung AmpUp (no response,
// never erroring) would otherwise stall the turn until the function's 300s limit.
// A timeout converts the hang into a fast error (mirrors lib/mcp.ts withTimeout).
const ENT_FETCH_TIMEOUT_MS = Number(process.env.ENTITLEMENT_FETCH_TIMEOUT_MS) || 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ENT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Per-user entitlement cache, keyed on the SERVER-VALIDATED mcpToken (never a
// client-supplied id — that would let a caller assert someone else's tier). The
// per-user key is short-lived (re-minted every few minutes), so this naturally
// scopes per session. In-process only; a cold instance re-fetches once. Its job
// is to keep `/user/me` (and the legacy Stripe lookup) off the per-turn hot path
// for burst follow-ups — the same problem the MCP tool cache solves in lib/mcp.ts.
const ENT_TTL_MS = Number(process.env.ENTITLEMENT_CACHE_TTL_MS) || 60_000;
const entCache = new Map<string, { ent: Entitlement; expires: number }>();

function entCacheGet(token: string): Entitlement | undefined {
  const hit = entCache.get(token);
  return hit && hit.expires > Date.now() ? hit.ent : undefined;
}
function entCacheSet(token: string, ent: Entitlement): void {
  // The key space (short-lived per-user tokens) is unbounded, so prune expired
  // entries before growing the map — keeps a long-lived warm instance from
  // accumulating dead tokens forever.
  if (entCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of entCache) {
      if (v.expires <= now) {
        entCache.delete(k);
      }
    }
  }
  entCache.set(token, { ent, expires: Date.now() + ENT_TTL_MS });
}

// One /user/me call classifies the caller. The AmpUp backend folds entitlement
// into that payload (`entitlement` + `free_turns_used`/`free_turns_limit`), so a
// subscribed/free user is resolved WITHOUT a per-turn Stripe round-trip. The
// legacy Stripe lookup runs only when the backend hasn't shipped the `entitlement`
// field yet — i.e. behavior is unchanged until that field exists (no free tier,
// non-Pro/non-subscribed callers still get blocked → 402).
//
// Returns a DEFINITIVE Entitlement, or THROWS on a transient failure (unreachable
// AmpUp / non-2xx / Stripe hiccup). The throw is deliberately distinct from a
// `blocked` verdict: the caller fails this turn closed but must NOT cache it, so a
// momentary backend blip doesn't lock the user (or an unlimited user) out for the
// whole cache TTL — the next turn re-checks.
async function fetchEntitlement(mcpToken: string): Promise<Entitlement> {
  const res = await fetchWithTimeout(`${apiBase()}/api/v1/user/me`, {
    headers: { Authorization: `Bearer ${mcpToken}` },
  });
  if (!res.ok) {
    throw new Error(`/user/me ${res.status}`);
  }
  const u = await res.json();
  // Legacy deploys (no `entitlement` field) still need the Stripe lookup to tell
  // a subscriber apart; the new payload is classified without any Stripe call.
  let subscribed = false;
  if (needsLegacyStripeCheck(u, isProEmail)) {
    const stripe = getStripe();
    if (stripe && u?.email) {
      const st = await customerStatus(stripe, u.email);
      subscribed = st.state === "subscribed";
    }
  }
  return classifyEntitlement(u, { isPro: isProEmail, subscribed });
}

async function resolveEntitlement(mcpToken: string | undefined): Promise<Entitlement> {
  if (process.env.MULTI_TENANT !== "true") {
    return { kind: "unlimited" };
  }
  if (!mcpToken) {
    return { kind: "blocked" };
  }
  const cached = entCacheGet(mcpToken);
  if (cached) {
    return cached;
  }
  try {
    const ent = await fetchEntitlement(mcpToken);
    entCacheSet(mcpToken, ent); // cache only DEFINITIVE verdicts
    return ent;
  } catch (err) {
    // Transient lookup failure: fail this turn closed (require the user's own key
    // rather than silently spending the operator's) but DON'T cache — let the next
    // turn re-check so a blip doesn't stick for the TTL.
    console.error("[gtm] entitlement lookup failed:", err);
    return { kind: "blocked" };
  }
}

// Decide whether this turn may run on the operator key, and whether it should be
// metered against the free allowance. BYOK turns are never gated or metered (the
// caller pays their own key). NOTE: on a follow-up turn the conversation's model
// is fixed at start (workflows/chat.ts), so a key added MID-conversation can't
// actually take effect on that run — letting BYOK bypass here means an exhausted
// free user can finish that one operator-funded thread for free. Bounded and
// acceptable: new conversations correctly use their key.
async function gateOperatorKey(
  byok: boolean,
  mcpToken: string | undefined
): Promise<{ block: true } | { meter: boolean }> {
  if (byok) {
    return { meter: false };
  }
  return gateDecision(byok, await resolveEntitlement(mcpToken));
}

// Count one free-tier turn against the AmpUp per-user ledger. The increment
// endpoint is the authoritative cap (enforced + returned server-side); we fold
// its returned counts back into the cache so the NEXT turn blocks promptly once
// the limit is hit, instead of waiting out the TTL. Best-effort: never fail a
// turn because metering didn't record (worst case a few extra free turns).
async function incrementFreeUsage(mcpToken: string | undefined): Promise<void> {
  if (!mcpToken) {
    return;
  }
  try {
    const res = await fetchWithTimeout(`${apiBase()}/api/v1/user/usage/increment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mcpToken}` },
    });
    if (!res.ok) {
      return;
    }
    const u = (await res.json()) as { free_turns_used?: number; free_turns_limit?: number };
    const limit = Number(u.free_turns_limit);
    const used = Number(u.free_turns_used);
    if (Number.isFinite(limit) && limit > 0) {
      entCacheSet(mcpToken, used < limit ? { kind: "free", used, limit } : { kind: "blocked" });
    }
  } catch (err) {
    console.error("[gtm] free-usage increment failed:", err);
  }
}

const LLM_KEY_REQUIRED = {
  error: "llm_key_required",
  message: "Add your own LLM API key in Settings → API keys to start chatting.",
};

/**
 * One durable run per conversation. The first turn starts the run; follow-ups
 * resume the conversation's hook and append to the same durable stream. Either
 * way we stream back just this turn's chunks and return the run id so the client
 * can stamp it onto the conversation and resume follow-up turns (and reopen via
 * /api/conversation/[runId]).
 *
 * Auth: the MCP key comes from the AMPUP_MCP_API_KEY env (one org per deploy).
 * A per-request x-ampup-mcp-key header overrides it if you front this with your
 * own multi-tenant auth.
 */
type IncomingServer = {
  slug?: string;
  name?: string;
  url?: string;
  token?: string;
  authHeader?: string;
};
type CustomServer = {
  slug: string;
  url: string;
  token?: string;
  authHeader?: string;
};

// Sanitize the client-supplied custom MCP servers: a clean slug, an http(s)
// url, and nothing else (slug "ampup" is reserved for the built-in server).
function normalizeServers(servers: IncomingServer[] | undefined): CustomServer[] {
  if (!Array.isArray(servers)) {
    return [];
  }
  const seen = new Set<string>(["ampup"]);
  const out: CustomServer[] = [];
  for (const s of servers) {
    const url = (s?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      continue;
    }
    if (isBlockedUrl(url)) {
      continue; // drop SSRF targets (private/reserved hosts)
    }
    let slug = (s?.slug || s?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!slug) {
      slug = `srv-${out.length + 1}`;
    }
    while (seen.has(slug)) {
      slug = `${slug}-2`;
    }
    seen.add(slug);
    out.push({
      slug,
      url,
      token: s?.token ? String(s.token) : undefined,
      authHeader: s?.authHeader ? String(s.authHeader) : undefined,
    });
  }
  return out;
}

// Per-turn backpressure on /api/chat. Two buckets: per CALLER (the per-user key,
// or IP when there's no key) and a wider per-IP bucket to blunt a single host
// cycling through keys. Tunable via env; defaults are generous for a human but
// stop a hot loop / bot. No-ops entirely when no KV store is configured.
const RL_WINDOW_SEC = Number(process.env.CHAT_RATELIMIT_WINDOW_SEC) || 60;
const RL_PER_USER = Number(process.env.CHAT_RATELIMIT_PER_USER) || 30;
const RL_PER_IP = Number(process.env.CHAT_RATELIMIT_PER_IP) || 60;

function tooMany(resetSec: number): Response {
  const retry = Math.max(1, resetSec);
  return Response.json(
    { error: "rate_limited", message: "Too many requests — slow down a moment." },
    { status: 429, headers: { ...CORS, "Retry-After": String(retry) } }
  );
}

// Returns a 429 Response if either bucket is over limit, else null. Checked
// before any heavy work (entitlement, MCP discovery, the durable run).
async function enforceRateLimits(
  req: Request,
  mcpToken: string | undefined
): Promise<Response | null> {
  const ip = clientIp(req);
  const callerId = mcpToken ? `u:${mcpToken}` : `ip:${ip}`;
  const [user, perIp] = await Promise.all([
    rateLimit(callerId, { limit: RL_PER_USER, windowSec: RL_WINDOW_SEC }),
    rateLimit(`ip:${ip}`, { limit: RL_PER_IP, windowSec: RL_WINDOW_SEC }),
  ]);
  if (!user.ok) {
    return tooMany(user.resetSec);
  }
  if (!perIp.ok) {
    return tooMany(perIp.resetSec);
  }
  return null;
}

export async function POST(req: Request) {
  const {
    conversationId,
    message,
    runId,
    mcpServers,
    systemPrompt,
    includeAmpup,
    systemContext,
  }: {
    conversationId: string;
    message: UIMessage;
    runId?: string;
    mcpServers?: IncomingServer[];
    systemPrompt?: string;
    includeAmpup?: boolean;
    systemContext?: string;
  } = await req.json();

  const mcpToken =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined;
  const multiTenant = process.env.MULTI_TENANT === "true";
  // Multi-tenant: require a per-request key; the workflow must not fall back to
  // the shared env key (which would leak one org's data to every visitor).
  if (multiTenant && !mcpToken) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { ...CORS } });
  }
  if (!(mcpToken || process.env.AMPUP_MCP_API_KEY)) {
    return Response.json(
      { error: "AMPUP_MCP_API_KEY is not configured" },
      { status: 401, headers: { ...CORS } }
    );
  }
  if (!(conversationId && message)) {
    return Response.json(
      { error: "conversationId and message are required" },
      { status: 400, headers: { ...CORS } }
    );
  }

  // Backpressure before any heavy work (entitlement lookup, MCP discovery, the
  // durable run). No-ops when no KV store is configured.
  const limited = await enforceRateLimits(req, mcpToken);
  if (limited) {
    return limited;
  }

  // The caller's own LLM key (if any) wins; otherwise the operator key funds the
  // turn — but only for verified internal/Pro callers or free-tier visitors with
  // an allowance left. Read on EVERY turn (the client re-sends these headers) so
  // the gate applies to follow-ups too, not just conversation start.
  const llmProvider = req.headers.get("x-llm-provider") || undefined;
  const llmKey = req.headers.get("x-llm-key") || undefined;
  const llmModel = req.headers.get("x-llm-model") || undefined;
  const byok = Boolean(llmKey && llmProvider);

  const gate = await gateOperatorKey(byok, mcpToken);
  if ("block" in gate) {
    return Response.json(LLM_KEY_REQUIRED, { status: 402, headers: { ...CORS } });
  }

  if (runId) {
    const run = getRun(runId);
    const tail = await run.getReadable().getTailIndex();
    await turnHook.resume(`conv:${conversationId}`, {
      message,
      mcpToken,
      systemContext: typeof systemContext === "string" ? systemContext : undefined,
    });
    // Count this follow-up turn (the conversation's model was fixed at start, so
    // a free-tier turn here still spends the operator key).
    if (gate.meter) {
      await incrementFreeUsage(mcpToken);
    }
    return createUIMessageStreamResponse({
      stream: run.getReadable({ startIndex: tail + 1 }),
      headers: { ...CORS, "x-workflow-run-id": runId },
    });
  }

  const llmOpts: LlmOpts | undefined = byok
    ? { provider: llmProvider, key: llmKey, model: llmModel }
    : undefined;

  const run = await start(conversationWorkflow, [
    conversationId,
    mcpToken,
    message,
    normalizeServers(mcpServers),
    typeof systemPrompt === "string" ? systemPrompt : undefined,
    includeAmpup !== false,
    llmOpts,
    typeof systemContext === "string" ? systemContext : undefined,
  ]);
  // Count the opening turn once the run has started.
  if (gate.meter) {
    await incrementFreeUsage(mcpToken);
  }
  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: { ...CORS, "x-workflow-run-id": run.runId },
  });
}
