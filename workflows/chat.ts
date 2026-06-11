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
import { resolveModel } from "@/lib/model";
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

export const turnHook = defineHook<{ message: UIMessage; mcpToken?: string }>();

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

export async function conversationWorkflow(
  conversationId: string,
  mcpToken: string | undefined,
  first: UIMessage,
  customServers: ServerCfg[] = [],
  systemPrompt?: string,
  includeAmpup = true
) {
  "use workflow";

  const { model, provider } = resolveModel();
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
  const discovered: Discovered[] = [];
  for (const s of startServers) {
    const defs = await discoverToolsStep(s);
    discovered.push({ slug: s.slug, defs, cfg: s });
  }

  // Rebuild the agent each turn so the ampup tool closures capture THIS turn's
  // (freshly re-minted) mcpToken. Custom-server cfgs are stable.
  const processTurn = async (message: UIMessage, turnToken: string | undefined) => {
    history.push(...(await convertToModelMessages([message])));
    const turnDiscovered = discovered.map((d) =>
      d.slug === AMPUP_SLUG ? { ...d, cfg: { slug: AMPUP_SLUG, token: turnToken ?? mcpToken } } : d
    );
    const agent = new DurableAgent({
      model,
      instructions,
      tools: {
        ...buildMcpTools(turnDiscovered),
        ...buildServerTools(provider, WEB_SEARCH),
      },
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

  await processTurn(first, mcpToken);

  const hook = turnHook.create({ token: `conv:${conversationId}` });
  for await (const { message, mcpToken: turnToken } of hook) {
    await processTurn(message, turnToken);
  }
}
