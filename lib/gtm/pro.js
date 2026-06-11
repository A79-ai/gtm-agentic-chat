// Pro entitlement allowlists — who is treated as a paying "Pro" user WITHOUT
// going through Stripe. Two operator-managed knobs, both client-safe
// (NEXT_PUBLIC_*, not secrets):
//
//   NEXT_PUBLIC_PRO_DOMAINS — comma-separated email domains auto-granted Pro
//                             (default: the internal AmpUp domains).
//   NEXT_PUBLIC_PRO_EMAILS  — comma-separated individual emails granted Pro
//                             on-demand. To grant/revoke: edit this list and
//                             redeploy (changing it requires deploy access, so
//                             it's inherently operator/super-admin restricted).
//
// Shared by the client (lib/gtm/billing.js) and the server
// (app/api/billing/status) so entitlement resolves the same either way.
//
// NOTE: read each env var as the LITERAL `process.env.NEXT_PUBLIC_*` — Next.js
// only inlines these when referenced literally (see lib/gtm/config.js).

const DEFAULT_PRO_DOMAINS = "ampup.ai,a79.ai";

const parseList = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const proDomains = () =>
  parseList(process.env.NEXT_PUBLIC_PRO_DOMAINS || DEFAULT_PRO_DOMAINS);

export const proEmails = () => parseList(process.env.NEXT_PUBLIC_PRO_EMAILS);

// True if `email` is auto-granted Pro: on the explicit email allowlist, or under
// an allowlisted domain.
export function isProEmail(email) {
  if (!email) {
    return false;
  }
  const e = String(email).trim().toLowerCase();
  if (proEmails().includes(e)) {
    return true;
  }
  const domain = e.split("@")[1] || "";
  return domain ? proDomains().includes(domain) : false;
}
