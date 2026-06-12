import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import { isProEmail } from "@/lib/gtm/pro";
import type { LlmOpts } from "@/lib/model";
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

// Whether the operator's OWN LLM key may power this caller's chat. Single-org
// dev: always (the operator key IS the model). Multi-tenant: only internal
// (Pro-allowlisted domain / admin) or paying-Pro users — verified server-side
// against the caller's own key, never a client-asserted flag.
async function operatorKeyAllowed(mcpToken: string | undefined): Promise<boolean> {
  if (process.env.MULTI_TENANT !== "true") {
    return true;
  }
  if (!mcpToken) {
    return false;
  }
  const base = (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
  try {
    const res = await fetch(`${base}/api/v1/user/me`, {
      headers: { Authorization: `Bearer ${mcpToken}` },
    });
    if (!res.ok) {
      return false;
    }
    const u = (await res.json()) as { email?: string; role?: string };
    const email = u.email || "";
    if (isProEmail(email) || u.role === "super_admin" || u.role === "admin") {
      return true;
    }
    const stripe = getStripe();
    if (stripe && email) {
      const st = await customerStatus(stripe, email);
      if (st.state === "subscribed") {
        return true;
      }
    }
    return false;
  } catch {
    // Best-effort: if the entitlement lookup fails, require the user's own key
    // rather than silently spending the operator's.
    return false;
  }
}

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

export async function POST(req: Request) {
  const {
    conversationId,
    message,
    runId,
    mcpServers,
    systemPrompt,
    includeAmpup,
  }: {
    conversationId: string;
    message: UIMessage;
    runId?: string;
    mcpServers?: IncomingServer[];
    systemPrompt?: string;
    includeAmpup?: boolean;
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

  if (runId) {
    const run = getRun(runId);
    const tail = await run.getReadable().getTailIndex();
    await turnHook.resume(`conv:${conversationId}`, { message, mcpToken });
    return createUIMessageStreamResponse({
      stream: run.getReadable({ startIndex: tail + 1 }),
      headers: { ...CORS, "x-workflow-run-id": runId },
    });
  }

  // Pick the LLM key for this conversation: the caller's own key if supplied,
  // otherwise the operator key — but only for verified internal/Pro callers.
  const llmProvider = req.headers.get("x-llm-provider") || undefined;
  const llmKey = req.headers.get("x-llm-key") || undefined;
  const llmModel = req.headers.get("x-llm-model") || undefined;
  let llmOpts: LlmOpts | undefined;
  if (llmKey && llmProvider) {
    llmOpts = { provider: llmProvider, key: llmKey, model: llmModel };
  } else if (!(await operatorKeyAllowed(mcpToken))) {
    return Response.json(
      {
        error: "llm_key_required",
        message: "Add your own LLM API key in Settings → API keys to start chatting.",
      },
      { status: 402, headers: { ...CORS } }
    );
  }

  const run = await start(conversationWorkflow, [
    conversationId,
    mcpToken,
    message,
    normalizeServers(mcpServers),
    typeof systemPrompt === "string" ? systemPrompt : undefined,
    includeAmpup !== false,
    llmOpts,
  ]);
  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: { ...CORS, "x-workflow-run-id": run.runId },
  });
}
