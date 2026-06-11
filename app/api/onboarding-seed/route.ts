// Kick off the backend free-trial demo seed for the signed-in user so a fresh
// trial workspace isn't empty (and the chat has real data to reason over).
//
// Mirrors the product's onboarding: POST /sales-agents/api/v1/onboarding/profile
// fires DEMO_CONTENT_GENERATE for free-trial orgs, which seeds PER-USER
// (owner-stamped) accounts, deals, and full meetings (transcript + pre/post
// briefs + analysis) plus 3 practice scripts, all scoped to the calling user.
//
// The backend profile endpoint requires industry / company_products /
// company_size / user_role. The wizard only collects company + role + size, so
// we LLM-derive the firmographics from the work-email domain via /company-lookup
// and map the chips to the backend enums. Idempotent: skips when the profile
// step is already past 0 (a backstop to the client's once-per-user guard), so a
// re-onboard / "Restart" never re-runs the paid LLM seed.
export const maxDuration = 60;

const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ampup-mcp-key, authorization",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function apiBase(): string {
  return (process.env.AMPUP_MCP_URL || "").replace(/\/mcp\/?$/, "");
}

function keyOf(req: Request): string {
  const headerKey =
    req.headers.get("x-ampup-mcp-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.MULTI_TENANT === "true") {
    return headerKey ?? "";
  }
  return headerKey ?? process.env.AMPUP_MCP_API_KEY ?? "";
}

// Backend UserRole enum.
const ROLE_MAP: Record<string, string> = {
  "account executive": "ae",
  "sdr / bdr": "sdr",
  revops: "rev_ops",
  "sales manager": "manager",
  founder: "founder",
};
function mapRole(role: string | undefined): string {
  return ROLE_MAP[(role || "").trim().toLowerCase()] || "other";
}

// Backend CompanySize enum values. Normalize dashes (the wizard chips use an
// en-dash) and accept either a wizard chip or an already-canonical value (e.g.
// company-lookup returns "51-200").
const SIZES = new Set(["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"]);
const SIZE_MAP: Record<string, string> = {
  "just me": "1-10",
  "2-10": "1-10",
  "11-50": "11-50",
  "51-200": "51-200",
  "200+": "201-1000",
};
function mapSize(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const v = (c || "").replace(/[‒-―]/g, "-").trim().toLowerCase();
    if (SIZES.has(v)) {
      return v;
    }
    if (SIZE_MAP[v]) {
      return SIZE_MAP[v];
    }
  }
  return "11-50";
}

// Personal mailbox providers are a poor company signal, so skip the lookup.
const PERSONAL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);
function companyDomain(email: string | undefined): string {
  const at = (email || "").split("@")[1]?.trim().toLowerCase();
  if (!at || PERSONAL.has(at) || !at.includes(".")) {
    return "";
  }
  return at;
}

type Lookup = {
  company_name?: string;
  industry?: string;
  company_products?: string;
  company_size?: string;
};

export async function POST(req: Request) {
  const key = keyOf(req);
  if (!key) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    company?: string;
    role?: string;
    size?: string;
    email?: string;
  };
  const auth = { Authorization: `Bearer ${key}` };

  // Idempotency backstop: if the profile step already advanced, the seed was
  // already triggered for this user, so don't re-fire the paid LLM job.
  try {
    const st = await fetch(`${apiBase()}/sales-agents/api/v1/onboarding/status`, { headers: auth });
    if (st.ok) {
      const s = (await st.json()) as { current_step?: number; completed?: boolean };
      if ((s.current_step ?? 0) >= 1 || s.completed) {
        return Response.json({ ok: true, already: true }, { headers: CORS });
      }
    }
  } catch {
    // Best-effort: a failed status check just means we fall through and let the
    // client-side once-per-user guard prevent duplicates.
  }

  // Derive firmographics from the work-email domain (best-effort).
  const domain = companyDomain(body.email);
  let look: Lookup = {};
  if (domain) {
    try {
      const r = await fetch(`${apiBase()}/sales-agents/api/v1/onboarding/company-lookup`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ url: domain }),
      });
      if (r.ok) {
        look = (await r.json()) as Lookup;
      }
    } catch {
      // Lookup is best-effort; defaults below keep the required fields valid.
    }
  }

  const companyName = (body.company || look.company_name || "").trim() || "My Company";
  const profile = {
    company_url: domain ? `https://${domain}` : "",
    company_name: companyName,
    industry: (look.industry || "").trim() || "Software",
    company_products:
      (look.company_products || "").trim() || `${companyName}'s products and services`,
    company_size: mapSize(look.company_size, body.size),
    user_role: mapRole(body.role),
  };

  try {
    const res = await fetch(`${apiBase()}/sales-agents/api/v1/onboarding/profile`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, status: res.status, error: (await res.text()).slice(0, 300) },
        { status: 502, headers: CORS }
      );
    }
    return Response.json({ ok: true, seeded: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502, headers: CORS });
  }
}
