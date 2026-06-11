// Install-success handler: seed a freshly-connected integration's meetings.
//
// The Ampersand `InstallIntegration` widget connects OAuth and starts the
// managed every-1-min read, but that only delivers events going *forward*:
// a new user's existing/upcoming calendar is never loaded. The AmpUp product
// fixes this at install time (upsert the installation + trigger backfill); the
// template previously discarded the install event entirely, so trial users saw
// an empty meeting list. This route mirrors the product:
//   1. future seed  → POST /sales-agents/api/v1/ampersand/backfills  (our Inngest
//      fans out sync/future-meetings; needs only the per-user key)
//   2. historical   → POST read.withampersand.com .../objects/events (Ampersand's
//      own read for the past N days; needs the backend Ampersand key, server-side)
// Both are best-effort: a failure of either must not break the connect flow.

export const maxDuration = 30;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// On-connect historical pull. Ampersand's own auto-backfill only reaches 14d
// (amp.yaml defaultPeriod), which misses the back half of "the last 2-3 weeks";
// pull 21 days for Google so a fresh install surfaces recent meetings. Other
// providers keep a 30-day window.
const HISTORICAL_DAYS = (integration: string): number =>
  integration.trim().toLowerCase() === "google" ? 21 : 30;

function apiBase(): string {
  // AMPUP_MCP_URL is "<host>/mcp"; the REST API lives at "<host>".
  return (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
}

type Rec = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

// Object names the user actually subscribed, from the Ampersand install config.
function objectNamesFromConfig(config: unknown): string[] {
  const objs = (config as Rec | null)?.["content"] as Rec | undefined;
  const read = objs?.["read"] as Rec | undefined;
  const objects = read?.["objects"] as Rec | undefined;
  if (!objects || typeof objects !== "object") {
    return [];
  }
  return Object.values(objects)
    .map((o) => s((o as Rec)?.["objectName"]))
    .filter(Boolean);
}

async function postJson(path: string, key: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return null;
    }
    return await res.json().catch(() => ({}));
  } catch {
    return null;
  }
}

// Wait for the Ampersand webhook to mirror the new install row before seeding,
// /backfills silently no-ops if the row isn't there yet. Returns the full row
// (we need its integration_id for the upsert below).
async function awaitInstallRow(
  key: string,
  installationId: string,
  groupRef: string,
  provider: string
): Promise<Rec | null> {
  const want = provider.toLowerCase();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${apiBase()}/sales-agents/api/v1/ampersand/installations`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const rows: Rec[] = res.ok ? ((await res.json()) as Rec[]) : [];
      const byId = rows.find((r) => s(r.id) === installationId);
      if (byId) {
        return byId;
      }
      const byMatch = rows.find(
        (r) =>
          s(r.group_ref) === groupRef &&
          (s(r.provider).toLowerCase() === want || s(r.integration_name).toLowerCase() === want)
      );
      if (byMatch) {
        return byMatch;
      }
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

// Ampersand's own historical read (past window) uses the BACKEND key, which
// must never reach the client, so this runs server-side only.
async function triggerHistoricalRead(
  integration: string,
  objectName: string,
  groupRef: string,
  days: number
): Promise<boolean> {
  const project = process.env.AMPERSAND_PROJECT_ID || "";
  const apiKey = process.env.AMPERSAND_API_KEY || "";
  if (!(project && apiKey)) {
    return false;
  }
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  try {
    const res = await fetch(
      `https://read.withampersand.com/v1/projects/${project}/integrations/${integration}/objects/${objectName}`,
      {
        method: "POST",
        headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ groupRef, mode: "async", sinceTimestamp: since }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const key =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    (process.env.MULTI_TENANT === "true" ? "" : (process.env.AMPUP_MCP_API_KEY ?? ""));
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  let body: Rec;
  try {
    body = (await req.json()) as Rec;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400, headers: CORS });
  }

  const installationId = s(body.installationId);
  const integration = s(body.integration) || "Google";
  const provider = (s(body.provider) || integration).toLowerCase();
  const groupRef = s(body.groupRef);
  const objects = objectNamesFromConfig(body.config);
  const objectNames = objects.length ? objects : ["events"];

  if (!groupRef) {
    return Response.json({ error: "missing groupRef" }, { status: 400, headers: CORS });
  }

  // Historical (Ampersand read) doesn't depend on our install row, so fire it now.
  const historical = await Promise.all(
    objectNames.map((o) =>
      triggerHistoricalRead(integration, o, groupRef, HISTORICAL_DAYS(integration))
    )
  ).then((rs) => rs.some(Boolean));

  // Both the upsert and the seed need the mirrored install row to exist.
  let seeded = false;
  let upserted = false;
  const row = await awaitInstallRow(key, installationId, groupRef, provider);
  if (row) {
    const rowId = s(row.id);
    // Upsert the installation. Beyond mirroring installed_objects, this is the
    // ONLY path that activates the free-trial notetaker trial server-side
    // (_maybe_activate_notetaker_trial fires for free-trial + calendar
    // providers). Without it `notetaker_trial_started_at` is never set, the
    // notetaker scheduling cron filters the user out, and the meeting-recorder
    // never joins any meeting. integration_id comes from the webhook-mirrored
    // row (the upsert requires it).
    const up = await postJson("/sales-agents/api/v1/ampersand/installations", key, {
      installation_id: rowId,
      integration_name: s(row.integration_name) || integration,
      integration_id: s(row.integration_id),
      provider: s(row.provider) || provider,
      group_ref: s(row.group_ref) || groupRef,
      consumer_ref: s(row.consumer_ref) || s(row.user_id) || undefined,
      installed_objects: objectNames,
    });
    upserted = up != null;

    const res = await postJson("/sales-agents/api/v1/ampersand/backfills", key, {
      installation_id: rowId,
      integration_name: integration,
      object_names: objectNames,
    });
    seeded = res != null;
  }

  return Response.json(
    { ok: true, seeded, upserted, historical, objects: objectNames, installRowFound: !!row },
    { headers: CORS }
  );
}
