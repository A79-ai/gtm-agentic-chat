// Connectors = the org's real integration catalog + which are registered
// (connected) for the org, plus the Ampersand project details. All fetched from
// the AmpUp backend with the org's key (same key the MCP uses).
import { callAmpupTool } from "@/lib/mcp";

export const maxDuration = 30;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Rec = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

// Map an AmpUp integration id to one of our connector brand logos.
const LOGO: Record<string, string> = {
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  dynamicscrm: "Dynamics",
  gong: "Gong",
  fireflies: "Fireflies",
  fathom: "Fathom",
  claricopilot: "Clari",
  granola: "Granola",
  devrev: "DevRev",
  slack: "Slack",
  google: "Google",
  microsoft: "Microsoft",
};

function apiBase(): string {
  // AMPUP_MCP_URL is "<host>/mcp"; the REST API lives at "<host>".
  const url = process.env.AMPUP_MCP_URL || "";
  return url.replace(/\/mcp\/?$/, "");
}

async function getJson(path: string, key: string): Promise<unknown> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

function configValue(configs: unknown, namespace: string, name: string): string {
  if (!Array.isArray(configs)) {
    return "";
  }
  const c = (configs as Rec[]).find((x) => x.namespace === namespace && x.name === name);
  return c ? s(c.value) : "";
}

export async function GET(req: Request) {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const multiTenant = process.env.MULTI_TENANT === "true";
  // Multi-tenant: require a per-request key (no shared env fallback) so an
  // unauthenticated call 401s instead of serving one org's data.
  const key = headerKey ?? (multiTenant ? "" : (process.env.AMPUP_MCP_API_KEY ?? ""));
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  const orgP = callAmpupTool("get_org", {}, key)
    .then((r) => (r.ok ? (JSON.parse(r.content).org as Rec) : null))
    .catch(() => null);
  const [catalogRaw, installsRaw, configsRaw, org] = await Promise.all([
    getJson("/api/v1/tool/integrations", key),
    getJson("/sales-agents/api/v1/ampersand/installations", key),
    getJson("/api/v1/configs", key),
    orgP,
  ]);

  const catalog: Rec[] = Array.isArray(catalogRaw) ? (catalogRaw as Rec[]) : [];
  const installs: Rec[] = Array.isArray(installsRaw) ? (installsRaw as Rec[]) : [];

  // An integration is "connected" if the org has an installation for it.
  const connectedKeys = new Set<string>();
  for (const inst of installs) {
    for (const k of [inst.integration_id, inst.provider, inst.integration_name]) {
      if (k) {
        connectedKeys.add(s(k).toLowerCase());
      }
    }
  }
  const isConnected = (item: Rec) =>
    connectedKeys.has(s(item.id).toLowerCase()) ||
    connectedKeys.has(s(item.ampersand_provider).toLowerCase());

  // Prefer org config; fall back to deploy env (the product bakes these as
  // VITE_AMPERSAND_*, since the org API doesn't expose them).
  const projectId =
    configValue(configsRaw, "sales_agent", "ampersand_project_id") ||
    process.env.AMPERSAND_PROJECT_ID ||
    "";
  const apiKey =
    configValue(configsRaw, "sales_agent", "ampersand_api_key") ||
    process.env.AMPERSAND_API_KEY ||
    "";

  // Ampersand's InstallIntegration matches by integration NAME (from the
  // project's amp.yaml), not provider. Map provider -> name from the project.
  const providerToName: Record<string, string> = {};
  if (projectId && apiKey) {
    const projInts = await fetch(
      `https://api.withampersand.com/v1/projects/${projectId}/integrations`,
      {
        headers: { "X-Api-Key": apiKey },
      }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (Array.isArray(projInts)) {
      for (const pi of projInts as Rec[]) {
        const prov = s(pi.provider).toLowerCase();
        // Prefer an exact-cased canonical name; don't let variants (e.g.
        // "Salesforce-Eightfold") overwrite the plain "Salesforce".
        if (prov && (!providerToName[prov] || s(pi.name).length < providerToName[prov].length)) {
          providerToName[prov] = s(pi.name);
        }
      }
    }
  }

  const connectors = catalog.map((item) => ({
    id: s(item.id),
    name: s(item.name),
    desc: s(item.description),
    cat: s(item.category) || "Other",
    provider: s(item.ampersand_provider),
    scope: s(item.in_product_install_scope),
    logo: LOGO[s(item.id)] || LOGO[s(item.ampersand_provider)] || "",
    connected: isConnected(item),
    ampersandName: providerToName[s(item.ampersand_provider).toLowerCase()] || "",
  }));

  const orgId = org ? s(org.id) : "";
  return Response.json(
    {
      ampersand: { configured: Boolean(projectId), projectId, apiKey },
      // Ampersand refs: org-scoped installs key off the org (groupRef). One
      // deploy = one org, so the consumer is the org itself.
      groupRef: orgId,
      consumerRef: orgId,
      org: { id: orgId, name: org ? s(org.name) : "" },
      connectedCount: installs.length,
      connectors,
    },
    { headers: CORS }
  );
}
