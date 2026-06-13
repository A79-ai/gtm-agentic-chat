// Pure entitlement classification + gate decision for the chat free-credit tier.
// Kept free of IO (no fetch/Stripe/env) so the state machine the operator key
// depends on is unit-testable in isolation — the route (app/api/chat/route.ts)
// supplies the IO (the /user/me payload, the Pro check, the legacy Stripe state).

// What the operator key may fund for a caller:
//   unlimited — single-org dev, or an internal/Pro/subscribed user (never metered)
//   free      — a free-tier visitor with a per-user turn allowance (metered)
//   blocked   — must bring their own LLM key (the 402 path)
export type Entitlement =
  | { kind: "unlimited" }
  | { kind: "free"; used: number; limit: number }
  | { kind: "blocked" };

// The subset of the AmpUp /user/me payload that bears on entitlement. The backend
// folds `entitlement` + the free-turn counters in (see docs/free-credit-ledger.md);
// older deploys won't have `entitlement`, which selects the legacy path below.
export type UserMePayload = {
  email?: string;
  role?: string;
  entitlement?: string;
  free_turns_used?: number;
  free_turns_limit?: number;
};

const UNLIMITED_ENTITLEMENTS = new Set(["subscribed", "pro", "unlimited"]);

// Map a /user/me payload to an Entitlement. Pure: the Pro-allowlist check and the
// legacy `subscribed` flag (resolved via Stripe only when there's no `entitlement`
// field) are injected by the caller.
export function classifyEntitlement(
  u: UserMePayload,
  opts: { isPro: (email: string) => boolean; subscribed?: boolean }
): Entitlement {
  const email = u.email || "";
  if (
    opts.isPro(email) ||
    u.role === "super_admin" ||
    u.role === "admin" ||
    (typeof u.entitlement === "string" && UNLIMITED_ENTITLEMENTS.has(u.entitlement))
  ) {
    return { kind: "unlimited" };
  }
  // New payload present: trust it, no Stripe.
  if (typeof u.entitlement === "string") {
    const limit = Number(u.free_turns_limit);
    if (Number.isFinite(limit) && limit > 0) {
      const used = Number(u.free_turns_used);
      return { kind: "free", used: Number.isFinite(used) ? used : 0, limit };
    }
    return { kind: "blocked" };
  }
  // Legacy: no `entitlement` field → only the (Stripe-resolved) subscribed flag
  // can grant access; otherwise blocked. Preserves prior behavior exactly.
  return opts.subscribed ? { kind: "unlimited" } : { kind: "blocked" };
}

// True when this payload's classification is DEFINITIVE without the legacy Stripe
// lookup — i.e. the route can skip Stripe entirely. (Anything unlimited, or any
// new-payload verdict.) Only a legacy, non-unlimited payload needs the Stripe call.
export function needsLegacyStripeCheck(
  u: UserMePayload,
  isPro: (email: string) => boolean
): boolean {
  const first = classifyEntitlement(u, { isPro });
  return first.kind === "blocked" && typeof u.entitlement !== "string";
}

// Decide whether a turn may run on the operator key and whether to meter it.
// BYOK turns are never gated or metered (the caller pays their own key).
export function gateDecision(
  byok: boolean,
  ent: Entitlement
): { block: true } | { meter: boolean } {
  if (byok) {
    return { meter: false };
  }
  if (ent.kind === "unlimited") {
    return { meter: false };
  }
  if (ent.kind === "free" && ent.used < ent.limit) {
    return { meter: true };
  }
  return { block: true };
}
