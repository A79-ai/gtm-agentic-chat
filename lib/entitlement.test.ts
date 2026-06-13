// Unit tests for the entitlement/gate state machine the operator key depends on.
// Pure logic (no IO), so this runs on Node's built-in test runner with native TS
// type-stripping — no extra test-runner dependency. Run: `pnpm test:unit`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyEntitlement,
  gateDecision,
  needsLegacyStripeCheck,
  type UserMePayload,
} from "./entitlement.ts";

// A Pro allowlist stub: only `pro@ampup.ai` is internal.
const isPro = (email: string) => email === "pro@ampup.ai";

test("classify: Pro-allowlisted email → unlimited", () => {
  assert.deepEqual(classifyEntitlement({ email: "pro@ampup.ai" }, { isPro }), {
    kind: "unlimited",
  });
});

test("classify: admin / super_admin role → unlimited", () => {
  for (const role of ["admin", "super_admin"]) {
    assert.equal(classifyEntitlement({ role }, { isPro }).kind, "unlimited");
  }
});

test("classify: subscribed/pro/unlimited entitlement → unlimited", () => {
  for (const entitlement of ["subscribed", "pro", "unlimited"]) {
    assert.equal(classifyEntitlement({ entitlement }, { isPro }).kind, "unlimited");
  }
});

test("classify: free entitlement with allowance → free with counts", () => {
  const ent = classifyEntitlement(
    { entitlement: "free", free_turns_used: 3, free_turns_limit: 10 },
    { isPro }
  );
  assert.deepEqual(ent, { kind: "free", used: 3, limit: 10 });
});

test("classify: free entitlement defaults missing used to 0", () => {
  const ent = classifyEntitlement({ entitlement: "free", free_turns_limit: 10 }, { isPro });
  assert.deepEqual(ent, { kind: "free", used: 0, limit: 10 });
});

test("classify: entitlement present but no positive limit → blocked", () => {
  assert.equal(classifyEntitlement({ entitlement: "none" }, { isPro }).kind, "blocked");
  assert.equal(
    classifyEntitlement({ entitlement: "free", free_turns_limit: 0 }, { isPro }).kind,
    "blocked"
  );
});

test("classify: NEW payload never consults the legacy subscribed flag", () => {
  // entitlement field present → Stripe state is irrelevant.
  const ent = classifyEntitlement({ entitlement: "none" }, { isPro, subscribed: true });
  assert.equal(ent.kind, "blocked");
});

test("classify: legacy payload (no entitlement field) honors subscribed flag", () => {
  assert.equal(
    classifyEntitlement({ email: "x@y.com" }, { isPro, subscribed: true }).kind,
    "unlimited"
  );
  assert.equal(
    classifyEntitlement({ email: "x@y.com" }, { isPro, subscribed: false }).kind,
    "blocked"
  );
});

test("needsLegacyStripeCheck: only for legacy, non-unlimited payloads", () => {
  // legacy + not pro → needs the Stripe lookup
  assert.equal(needsLegacyStripeCheck({ email: "x@y.com" }, isPro), true);
  // new payload → never
  assert.equal(needsLegacyStripeCheck({ entitlement: "none" }, isPro), false);
  assert.equal(needsLegacyStripeCheck({ entitlement: "free", free_turns_limit: 5 }, isPro), false);
  // pro is already unlimited → no Stripe needed
  assert.equal(needsLegacyStripeCheck({ email: "pro@ampup.ai" }, isPro), false);
});

test("gate: BYOK always bypasses, even when entitlement would block", () => {
  assert.deepEqual(gateDecision(true, { kind: "blocked" }), { meter: false });
  assert.deepEqual(gateDecision(true, { kind: "free", used: 99, limit: 10 }), { meter: false });
});

test("gate: unlimited runs unmetered", () => {
  assert.deepEqual(gateDecision(false, { kind: "unlimited" }), { meter: false });
});

test("gate: free under limit is metered; at/over limit is blocked", () => {
  assert.deepEqual(gateDecision(false, { kind: "free", used: 0, limit: 10 }), { meter: true });
  assert.deepEqual(gateDecision(false, { kind: "free", used: 9, limit: 10 }), { meter: true });
  // exactly at the limit → blocked (the Nth turn already spent the allowance)
  assert.deepEqual(gateDecision(false, { kind: "free", used: 10, limit: 10 }), { block: true });
  assert.deepEqual(gateDecision(false, { kind: "free", used: 11, limit: 10 }), { block: true });
});

test("gate: blocked entitlement without BYOK → block", () => {
  assert.deepEqual(gateDecision(false, { kind: "blocked" }), { block: true });
});

test("end-to-end: a fresh free user's first 10 turns meter, then block", () => {
  const limit = 10;
  let blocked = false;
  let metered = 0;
  for (let used = 0; used < 12; used++) {
    const payload: UserMePayload = {
      entitlement: "free",
      free_turns_used: used,
      free_turns_limit: limit,
    };
    const decision = gateDecision(false, classifyEntitlement(payload, { isPro }));
    if ("block" in decision) {
      blocked = true;
    } else if (decision.meter) {
      metered++;
    }
  }
  assert.equal(metered, 10, "exactly `limit` turns are metered");
  assert.equal(blocked, true, "turns past the limit are blocked");
});
