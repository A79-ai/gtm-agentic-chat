import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, defineHook } from "workflow";
import {
  stepCountIs,
  jsonSchema,
  tool,
  convertToModelMessages,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { resolveModel } from "@/lib/model";
import { buildServerTools } from "@/lib/serverTools";
import { SYSTEM_PROMPT, WEB_SEARCH, MAX_STEPS } from "@/lib/config";
import type { McpToolDef } from "@/lib/mcp";

/**
 * One durable run per CONVERSATION (Vercel's reference pattern for chat on the
 * Workflow DevKit). The first turn starts the run; follow-ups are delivered by
 * `turnHook.resume("conv:<id>")` and append to the SAME durable stream, so the
 * run's stream IS the transcript — replaying it rehydrates the chat on reopen.
 *
 * Tools are discovered at runtime from the org's MCP server (tools/list), so the
 * agent automatically exposes whatever that org has enabled. The MCP SDK is
 * dynamic-imported inside "use step" so it never enters the workflow bundle.
 */

// The model calls tools as mcp__ampup__<name>; we register under that prefix and
// strip it before hitting the MCP server.
const TOOL_PREFIX = "mcp__ampup__";

export const turnHook = defineHook<{ message: UIMessage; mcpToken?: string }>();

async function discoverToolsStep(mcpToken?: string): Promise<McpToolDef[]> {
  "use step";
  const { listAmpupTools } = await import("../lib/mcp");
  return listAmpupTools(mcpToken);
}

async function callMcpStep(
  bareName: string,
  args: Record<string, unknown>,
  mcpToken?: string,
) {
  "use step";
  const { callAmpupTool } = await import("../lib/mcp");
  return callAmpupTool(bareName, args ?? {}, mcpToken);
}

function buildAmpupTools(defs: McpToolDef[], mcpToken?: string): ToolSet {
  const tools: ToolSet = {};
  for (const t of defs) {
    tools[TOOL_PREFIX + t.name] = tool({
      description: t.description,
      // DurableAgent calls schema.validate?.() and throws if missing, so pass
      // through (the MCP server validates args server-side).
      inputSchema: jsonSchema<Record<string, unknown>>(t.inputSchema, {
        validate: (value) => ({
          success: true,
          value: (value ?? {}) as Record<string, unknown>,
        }),
      }),
      execute: async (args: Record<string, unknown>) =>
        callMcpStep(t.name, args, mcpToken),
    });
  }
  return tools;
}

export async function conversationWorkflow(
  conversationId: string,
  mcpToken: string | undefined,
  first: UIMessage,
) {
  "use workflow";

  const { model, provider } = resolveModel();
  const writable = getWritable<UIMessageChunk>();
  const history: ModelMessage[] = [];

  // Discover the org's tools once per conversation; reuse across turns.
  const toolDefs = await discoverToolsStep(mcpToken);

  // Rebuild the agent each turn so its tool closures capture THIS turn's
  // (freshly re-minted) mcpToken.
  const processTurn = async (
    message: UIMessage,
    turnToken: string | undefined,
  ) => {
    history.push(...(await convertToModelMessages([message])));
    const agent = new DurableAgent({
      model,
      instructions: SYSTEM_PROMPT,
      tools: {
        ...buildAmpupTools(toolDefs, turnToken ?? mcpToken),
        ...buildServerTools(provider, WEB_SEARCH),
      },
    });
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
  };

  await processTurn(first, mcpToken);

  const hook = turnHook.create({ token: `conv:${conversationId}` });
  for await (const { message, mcpToken: turnToken } of hook) {
    await processTurn(message, turnToken);
  }
}
