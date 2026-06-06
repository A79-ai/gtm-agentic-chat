import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

// Imported ONLY via dynamic import inside a "use step" so the MCP SDK (Node
// modules) never enters the workflow bundle. A fresh connection per call keeps
// each durable step self-contained / replayable.

function resolve(apiKey?: string): { url: string; key: string } {
  const url = process.env.AMPUP_MCP_URL;
  const key = apiKey || process.env.AMPUP_MCP_API_KEY;
  if (!url || !key) throw new Error("AMPUP_MCP_URL / AMPUP_MCP_API_KEY not set");
  return { url, key };
}

async function connect(apiKey?: string): Promise<Client> {
  const { url, key } = resolve(apiKey);
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  const client = new Client({ name: "gtm-agentic-chat", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/** Discover the tools this org's MCP server exposes (runtime tools/list). */
export async function listAmpupTools(apiKey?: string): Promise<McpToolDef[]> {
  const client = await connect(apiKey);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    }));
  } finally {
    await client.close();
  }
}

/** Call a single ampup MCP tool and return a serializable result. */
export async function callAmpupTool(
  name: string,
  args: Record<string, unknown>,
  apiKey?: string,
): Promise<{ ok: boolean; content: string }> {
  const client = await connect(apiKey);
  try {
    const res = await client.callTool({ name, arguments: args ?? {} });
    const parts = (res.content ?? []) as Array<{ type: string; text?: string }>;
    const content = parts
      .map((c) => (c.type === "text" ? (c.text ?? "") : JSON.stringify(c)))
      .join("");
    return { ok: !res.isError, content };
  } finally {
    await client.close();
  }
}
