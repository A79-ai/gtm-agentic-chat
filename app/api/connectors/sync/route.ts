// Per-connector sync status. Surfaces Ampersand backfill (historical "replay")
// progress so a connected integration (esp. Google calendar) can show how much
// of its history has been pulled. Fail-soft: any error returns an empty map so
// a connector simply shows no sync detail rather than breaking the page.
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
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function apiBase(): string {
  // AMPUP_MCP_URL is "<host>/mcp"; the REST API lives at "<host>".
  const url = process.env.AMPUP_MCP_URL || "";
  return url.replace(/\/mcp\/?$/, "");
}

// Each upstream call is bounded so one slow integration can't stall the whole
// route to maxDuration. On timeout / non-200 we fail-soft to null.
const CALL_TIMEOUT_MS = 6000;
// Hard ceiling on per-backfill progress fetches per request.
const MAX_PROGRESS_CALLS = 20;

async function getJson(path: string, key: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const isInProgress = (status: string) => /in[_\s-]?progress|running|pending/i.test(status);
const isCompleted = (status: string) => /complete|success|done|synced/i.test(status);

type ObjectStatus = { object_name: string; status: string; percentage: number | null };
type SyncEntry = {
  status: "syncing" | "synced" | "idle";
  percentage: number | null;
  recordsProcessed: number | null;
  recordsTotal: number | null;
  objects: ObjectStatus[];
  completedAt: string | null;
};

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

  const raw = await getJson("/sales-agents/api/v1/ampersand/backfills", key);
  const backfills: Rec[] = Array.isArray(raw) ? (raw as Rec[]) : [];

  // Resolve live progress for the in-progress backfills only (completed ones are
  // 100%, failed ones contribute nothing). Cap total progress calls.
  const inProgress = backfills
    .filter((b) => isInProgress(s(b.status)))
    .slice(0, MAX_PROGRESS_CALLS);
  const progressById = new Map<string, Rec>();
  const settled = await Promise.all(
    inProgress.map((b) =>
      getJson(`/sales-agents/api/v1/ampersand/backfills/${s(b.id)}/progress`, key).then(
        (p) => [s(b.id), p] as const
      )
    )
  );
  for (const [id, p] of settled) {
    if (p && typeof p === "object") {
      progressById.set(id, p as Rec);
    }
  }

  // Aggregate per integration (keyed by lowercased integration_name). Per object:
  // a progress record when we have one, else derive from the backfill row.
  const byIntegration = new Map<string, ObjectStatus[]>();
  const completedAtByIntegration = new Map<string, string>();
  for (const b of backfills) {
    const intg = s(b.integration_name).toLowerCase();
    if (!intg) {
      continue;
    }
    const prog = progressById.get(s(b.id));
    const status = s(prog?.status ?? b.status);
    const pct = isCompleted(status) ? 100 : num(prog?.percentage);
    const list = byIntegration.get(intg) || [];
    list.push({
      object_name: s(prog?.object_name ?? b.object_name),
      status,
      percentage: pct,
    });
    byIntegration.set(intg, list);
    const completedAt = s(prog?.completed_at ?? b.completed_at);
    if (completedAt && isCompleted(status)) {
      completedAtByIntegration.set(intg, completedAt);
    }
  }

  const sync: Record<string, SyncEntry> = {};
  for (const [intg, objects] of byIntegration) {
    const anyInProgress = objects.some((o) => isInProgress(o.status));
    const anyCompleted = objects.some((o) => isCompleted(o.status));
    const status: SyncEntry["status"] = anyInProgress
      ? "syncing"
      : anyCompleted
        ? "synced"
        : "idle";

    let recordsProcessed: number | null = null;
    let recordsTotal: number | null = null;
    for (const b of backfills) {
      if (s(b.integration_name).toLowerCase() !== intg) {
        continue;
      }
      const prog = progressById.get(s(b.id));
      const proc = num(prog?.records_processed);
      const total = num(prog?.records_estimated_total);
      if (proc != null) {
        recordsProcessed = (recordsProcessed ?? 0) + proc;
      }
      if (total != null) {
        recordsTotal = (recordsTotal ?? 0) + total;
      }
    }

    const pcts = objects.map((o) => o.percentage).filter((p): p is number => p != null);
    const percentage =
      status === "synced"
        ? 100
        : pcts.length
          ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
          : null;

    sync[intg] = {
      status,
      percentage,
      recordsProcessed,
      recordsTotal,
      objects,
      completedAt: completedAtByIntegration.get(intg) || null,
    };
  }

  return Response.json({ sync }, { headers: CORS });
}
