import { DurableAgent } from "@workflow/ai/agent";
import {
  convertToModelMessages,
  jsonSchema,
  type ModelMessage,
  stepCountIs,
  type ToolSet,
  tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { defineHook, getWritable } from "workflow";
import { MAX_STEPS, SYSTEM_PROMPT, WEB_SEARCH } from "@/lib/config";
import type { McpToolDef } from "@/lib/mcp";
import { type LlmOpts, resolveModel } from "@/lib/model";
import { buildServerTools } from "@/lib/serverTools";

/**
 * One durable run per CONVERSATION (Vercel's reference pattern for chat on the
 * Workflow DevKit). The first turn starts the run; follow-ups are delivered by
 * `turnHook.resume("conv:<id>")` and append to the SAME durable stream, so the
 * run's stream IS the transcript: replaying it rehydrates the chat on reopen.
 *
 * Tools are discovered at runtime from one or more MCP servers (tools/list). The
 * built-in "ampup" server comes from env (one org per deploy); the user can add
 * extra MCP servers in Connectors, threaded in at conversation start. Each
 * server's tools are namespaced `mcp__<slug>__<tool>` so they never collide. The
 * MCP SDK is dynamic-imported inside "use step" so it never enters the bundle.
 *
 * The SERVER SET and SYSTEM PROMPT are fixed at conversation start (tools are
 * discovered once). Only the ampup token is re-minted per turn (custom-server
 * tokens are static user-entered values captured once).
 */

// A server config threaded through the workflow. `url`/`token` are omitted for
// the built-in ampup server (resolved from env inside the step).
type ServerCfg = {
  slug: string;
  url?: string;
  token?: string;
  authHeader?: string;
};

const AMPUP_SLUG = "ampup";

export const turnHook = defineHook<{
  message: UIMessage;
  mcpToken?: string;
  // Per-turn grounding context (attached records + identity), injected into the
  // SYSTEM prompt for this turn — kept out of the user message, and refreshed
  // each turn so it reflects whatever is attached now.
  systemContext?: string;
}>();

function resolveCfg(server: ServerCfg): {
  slug: string;
  url: string;
  token?: string;
  authHeader?: string;
} {
  const url = server.url ?? process.env.AMPUP_MCP_URL ?? "";
  const token = server.token ?? process.env.AMPUP_MCP_API_KEY;
  return { slug: server.slug, url, token, authHeader: server.authHeader };
}

async function discoverToolsStep(server: ServerCfg): Promise<McpToolDef[]> {
  "use step";
  const { listServerTools } = await import("../lib/mcp");
  try {
    return await listServerTools(resolveCfg(server));
  } catch (err) {
    // A user-added MCP server may be unreachable / misconfigured; degrade to no
    // tools for that server rather than failing the whole conversation.
    console.error(`MCP discovery failed for "${server.slug}":`, err);
    return [];
  }
}

async function callMcpStep(
  server: ServerCfg,
  bareName: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; content: string }> {
  "use step";
  const { callServerTool } = await import("../lib/mcp");
  try {
    return await callServerTool(resolveCfg(server), bareName, args ?? {});
  } catch (err) {
    // Return a terminal error result instead of throwing: the tool part reaches
    // a final state (so the client stops "loading") and the model gets a result
    // it can explain, rather than the turn hanging or dying silently.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`MCP tool "${bareName}" failed:`, err);
    return { ok: false, content: `Tool "${bareName}" failed: ${message}` };
  }
}

type Discovered = { slug: string; defs: McpToolDef[]; cfg: ServerCfg };

function buildMcpTools(discovered: Discovered[]): ToolSet {
  const tools: ToolSet = {};
  for (const { slug, defs, cfg } of discovered) {
    for (const t of defs) {
      tools[`mcp__${slug}__${t.name}`] = tool({
        description: t.description,
        // DurableAgent calls schema.validate?.() and throws if missing, so pass
        // through (the MCP server validates args server-side).
        inputSchema: jsonSchema<Record<string, unknown>>(t.inputSchema, {
          validate: (value) => ({
            success: true,
            value: (value ?? {}) as Record<string, unknown>,
          }),
        }),
        execute: async (args: Record<string, unknown>) => callMcpStep(cfg, t.name, args),
      });
    }
  }
  return tools;
}

// The discovered tool block is large (the ampup server alone advertises ~289
// tools ≈ 47k tokens) and identical across a conversation's turns. One ephemeral
// cache_control breakpoint on the LAST tool makes Anthropic cache the whole tool
// prefix (tools are cached before system/messages), so turns 2+ within the 5-min
// TTL read it from cache: ~90% input-token cost cut, plus a server-side
// prefill-skip (modest TTFT effect). Tool order is stable per conversation
// (discovered once), so the cached prefix matches turn-to-turn.
//
// Honored by @ai-sdk/anthropic (Anthropic-direct); the field is ignored by other
// providers, and Vercel AI Gateway passthrough is UNVERIFIED — confirm cache_read
// tokens on the gateway path before relying on it there.
function applyToolCacheBreakpoint(tools: ToolSet): ToolSet {
  const names = Object.keys(tools);
  if (names.length === 0) {
    return tools;
  }
  const last = names[names.length - 1];
  tools[last] = {
    ...tools[last],
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  } as ToolSet[string];
  return tools;
}

// NOTE: server-side token smoothing (ai's smoothStream / a custom transform) is
// NOT viable on this runtime. DurableAgent applies `experimental_transform` inside
// `doStreamStep`, which is a "use step" — its args are devalue-serialized across
// the durable boundary, so a transform CLOSURE crashes with "Cannot stringify a
// function" (the same reason lib/model.ts makes the model a registered step
// factory; a TransformStream factory can't be a registered step). Cadence
// smoothing is therefore done on the client: useChat's `experimental_throttle`
// batches chunk→render to a steady interval. True word-by-word reveal, if wanted,
// also belongs on the client.

// Emit an ephemeral status line to the durable stream. `transient: true` means
// the client receives it via useChat's onData but it is NOT added to message
// history (so it never persists or replays on reopen — it's pure live feedback).
// Manual stream writes are only allowed inside a "use step", so this is its own
// step. Used to fill the dead time before the first token — most importantly the
// first-turn MCP discovery (tools/list), which can take 1-3s with nothing else on
// screen but a content-free spinner.
async function emitStatus(text: string) {
  "use step";
  const writer = getWritable<UIMessageChunk>().getWriter();
  await writer.write({
    type: "data-status",
    data: { text },
    transient: true,
  } as unknown as UIMessageChunk);
  writer.releaseLock();
}

export async function conversationWorkflow(
  conversationId: string,
  mcpToken: string | undefined,
  first: UIMessage,
  customServers: ServerCfg[] = [],
  systemPrompt?: string,
  includeAmpup = true,
  llmOpts?: LlmOpts,
  firstSystemContext?: string
) {
  "use workflow";

  // Model is fixed for the conversation (resolved at start, replayed from the
  // persisted run input). A user's BYO key wins; otherwise the operator env key
  // — the route only allows that for internal/Pro callers.
  const { model, provider } = resolveModel(llmOpts);
  const writable = getWritable<UIMessageChunk>();
  const history: ModelMessage[] = [];
  const instructions = systemPrompt && systemPrompt.trim() ? systemPrompt : SYSTEM_PROMPT;

  // Server set is fixed at conversation start. Discover each server's tools once
  // and reuse across turns. The ampup server's token is re-minted per turn, so
  // its cfg token is rebuilt below; custom servers keep their start-time token.
  // An agent can drop the built-in CRM (includeAmpup=false) to run pure-custom.
  const startServers: ServerCfg[] = [
    ...(includeAmpup ? [{ slug: AMPUP_SLUG, token: mcpToken }] : []),
    ...(customServers || []).filter((s) => s && s.slug && s.slug !== AMPUP_SLUG),
  ];
  // First-turn feedback: discovery (tools/list) below blocks the first token by
  // 1-3s, so acknowledge immediately instead of leaving a content-free spinner.
  if (startServers.length) {
    await emitStatus("Connecting to your tools…");
  }
  const discovered: Discovered[] = [];
  for (const s of startServers) {
    const defs = await discoverToolsStep(s);
    discovered.push({ slug: s.slug, defs, cfg: s });
  }

  // Rebuild the agent each turn so the ampup tool closures capture THIS turn's
  // (freshly re-minted) mcpToken. Custom-server cfgs are stable.
  const processTurn = async (
    message: UIMessage,
    turnToken: string | undefined,
    turnSystemContext?: string
  ) => {
    history.push(...(await convertToModelMessages([message])));
    await emitStatus("Thinking…");
    const turnDiscovered = discovered.map((d) =>
      d.slug === AMPUP_SLUG ? { ...d, cfg: { slug: AMPUP_SLUG, token: turnToken ?? mcpToken } } : d
    );
    // Attached-record + identity context rides in the SYSTEM prompt (not the user
    // message), refreshed per turn so it tracks the current attachments.
    const turnInstructions =
      turnSystemContext && turnSystemContext.trim()
        ? `${instructions}\n\n${turnSystemContext.trim()}`
        : instructions;
    const agent = new DurableAgent({
      model,
      instructions: turnInstructions,
      tools: applyToolCacheBreakpoint({
        ...buildMcpTools(turnDiscovered),
        ...buildServerTools(provider, WEB_SEARCH),
      }),
    });
    try {
      const result = await agent.stream({
        messages: history,
        writable,
        preventClose: true, // keep the durable stream open for the next turn
        stopWhen: stepCountIs(MAX_STEPS),
        collectUIMessages: true,
      });
      if (result.uiMessages?.length) {
        history.push(...(await convertToModelMessages(result.uiMessages)));
      }
    } catch (err) {
      // Swallow a failed turn so it doesn't crash the whole conversation run
      // (the hook loop must keep serving follow-up turns). The workflow runtime
      // doesn't let us write a custom terminal chunk here, so the client settles
      // the spinner via its own stall watchdog.
      console.error("chat turn failed:", err);
    }
  };

  await processTurn(first, mcpToken, firstSystemContext);

  const hook = turnHook.create({ token: `conv:${conversationId}` });
  for await (const { message, mcpToken: turnToken, systemContext } of hook) {
    await processTurn(message, turnToken, systemContext);
  }
}
