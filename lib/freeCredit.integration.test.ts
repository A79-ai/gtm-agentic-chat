// Integration test for the free-credit gate: drives the REAL decision logic
// (classifyEntitlement + gateDecision from lib/entitlement.ts) against a mock
// AmpUp backend implementing the exact contract in docs/free-credit-ledger.md,
// across a sequence of turns. Proves the end-to-end behavior the user cares about:
// a free-tier visitor gets N operator-funded turns WITHOUT an LLM key, then the
// (N+1)th is blocked (→ the 402 "bring your own key" gate in the chat route).
//
// No LLM and no deployed backend required — the mock stands in for AmpUp. Runs
// under `pnpm test:unit`.
import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { classifyEntitlement, gateDecision } from "./entitlement.ts";

// Mock AmpUp backend (the half PR #10132 implements):
//   GET  /api/v1/user/me              -> { email, role, entitlement, free_turns_* }
//   POST /api/v1/user/usage/increment -> atomic "UPDATE ... WHERE used < limit",
//                                        returns the new counts (server-side cap).
function startMockAmpup(limit: number): Promise<{
  base: string;
  usage: () => number;
  close: () => Promise<void>;
}> {
  let used = 0;
  const server = http.createServer((req, res) => {
    const send = (obj: unknown) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(obj));
    };
    if (req.method === "GET" && req.url === "/api/v1/user/me") {
      send({
        email: "visitor@example.com", // deliberately NOT a Pro domain
        role: "user",
        entitlement: "free", // free-trial-org visitor
        free_turns_used: used,
        free_turns_limit: limit,
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/user/usage/increment") {
      if (used < limit) {
        used += 1; // conditional update never overruns the cap
      }
      send({ free_turns_used: used, free_turns_limit: limit });
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        base: `http://127.0.0.1:${port}`,
        usage: () => used,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// The internal AmpUp domains treated as Pro (mirrors lib/gtm/pro defaults).
const isPro = (email: string) => email.endsWith("@ampup.ai") || email.endsWith("@a79.ai");

// One non-BYOK chat turn, exactly as app/api/chat/route.ts gates it: read /user/me,
// classify, decide; if it's a metered free turn, count it against the ledger.
// Returns whether the turn would run ("allow") or hit the 402 BYOK gate ("block").
async function runTurn(base: string): Promise<"allow" | "block"> {
  const me = await (await fetch(`${base}/api/v1/user/me`)).json();
  const decision = gateDecision(false /* byok */, classifyEntitlement(me, { isPro }));
  if ("block" in decision) {
    return "block";
  }
  if (decision.meter) {
    await fetch(`${base}/api/v1/user/usage/increment`, { method: "POST" });
  }
  return "allow";
}

test("free tier: 10 turns run without an API key, the 11th is blocked", async () => {
  const mock = await startMockAmpup(10);
  try {
    const outcomes: Array<"allow" | "block"> = [];
    for (let i = 0; i < 12; i++) {
      outcomes.push(await runTurn(mock.base));
    }

    const allowed = outcomes.filter((o) => o === "allow").length;
    assert.equal(allowed, 10, "exactly 10 free turns run without a key");
    assert.equal(outcomes.indexOf("block"), 10, "the 11th turn is the first blocked");
    assert.equal(mock.usage(), 10, "the server-side counter caps at the limit");

    // Readable proof for the run log.
    console.log(
      outcomes.map((o, i) => `turn ${i + 1}: ${o === "allow" ? "✓ free" : "✗ 402 BYOK"}`).join("\n")
    );
  } finally {
    await mock.close();
  }
});
