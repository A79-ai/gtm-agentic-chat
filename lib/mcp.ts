import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

// A resolved MCP server target. `slug` namespaces its tools as
// `mcp__<slug>__<tool>` so multiple servers can coexist without collisions.
export type McpServer = {
  slug: string;
  url: string;
  token?: string;
  // Header the token is sent in. Defaults to "Authorization" with a "Bearer "
  // prefix; any other header sends the raw token value.
  authHeader?: string;
};

// Imported ONLY via dynamic import inside a "use step" so the MCP SDK (Node
// modules) never enters the workflow bundle. A fresh connection per call keeps
// each durable step self-contained / replayable.

// Bound every MCP round-trip. Without this a hung server (no response, never
// erroring) keeps a tool call "in progress" until the function's 300s limit —
// which the client reads as a turn that loads forever. A timeout converts the
// hang into a terminal error the agent can respond to.
const MCP_TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS) || 45_000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${MCP_TIMEOUT_MS}ms`)),
      MCP_TIMEOUT_MS,
    );
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function headersFor(server: McpServer): Record<string, string> {
  if (!server.token) return {};
  const header =
    server.authHeader && server.authHeader.trim() && server.authHeader !== "Authorization"
      ? server.authHeader.trim()
      : "Authorization";
  const value = header === "Authorization" ? `Bearer ${server.token}` : server.token;
  return { [header]: value };
}

async function connect(server: McpServer): Promise<Client> {
  if (!server.url) throw new Error(`MCP server "${server.slug}" has no url`);
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers: headersFor(server) },
  });
  const client = new Client({ name: "gtm-agentic-chat", version: "0.1.0" });
  await withTimeout(client.connect(transport), `MCP connect "${server.slug}"`);
  return client;
}

/** Discover the tools an MCP server exposes (runtime tools/list). */
export async function listServerTools(server: McpServer): Promise<McpToolDef[]> {
  const client = await connect(server);
  try {
    const { tools } = await withTimeout(client.listTools(), `MCP listTools "${server.slug}"`);
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

/** Call a single MCP tool on a server and return a serializable result. */
export async function callServerTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; content: string }> {
  const client = await connect(server);
  try {
    const res = await withTimeout(
      client.callTool({ name, arguments: args ?? {} }),
      `MCP tool "${name}"`,
    );
    const parts = (res.content ?? []) as Array<{ type: string; text?: string }>;
    const content = parts
      .map((c) => (c.type === "text" ? (c.text ?? "") : JSON.stringify(c)))
      .join("");
    return { ok: !res.isError, content };
  } finally {
    await client.close();
  }
}

// ---- Built-in "ampup" server (env-configured; one org per deploy) ----

function ampupServer(apiKey?: string): McpServer {
  const url = process.env.AMPUP_MCP_URL;
  const key = apiKey || process.env.AMPUP_MCP_API_KEY;
  if (!url || !key) throw new Error("AMPUP_MCP_URL / AMPUP_MCP_API_KEY not set");
  return { slug: "ampup", url, token: key };
}

/** Discover the built-in ampup server's tools (used by REST routes). */
export function listAmpupTools(apiKey?: string): Promise<McpToolDef[]> {
  return listServerTools(ampupServer(apiKey));
}

/** Call a tool on the built-in ampup server (used by REST routes). */
export function callAmpupTool(
  name: string,
  args: Record<string, unknown>,
  apiKey?: string,
): Promise<{ ok: boolean; content: string }> {
  return callServerTool(ampupServer(apiKey), name, args ?? {});
}
