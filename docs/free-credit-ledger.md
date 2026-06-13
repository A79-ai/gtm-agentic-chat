# Free-credit ledger — AmpUp backend spec

The hosted chat (`chat.ampup.ai`, `MULTI_TENANT=true`) gives each new visitor a
small allowance of operator-funded chat turns, then falls back to **bring your
own LLM key** (the existing `402 llm_key_required` gate). The client-side wiring
is done (`app/api/chat/route.ts`); it depends on two additions to the AmpUp
backend, described here.

We track the allowance on AmpUp — not a separate Redis — because AmpUp already
owns per-user identity (the minted `sk-a79` key + `/api/v1/user/me`) and persists
per-user conversations. The ledger then lives next to the billing source of truth
and survives across devices/sessions (browser `localStorage` would not).

## Calibrating `free_turns_limit` (≈ $5)

A *turn* = one user message → one agent run of up to `MAX_STEPS = 30` tool steps.
Each step is a full model call that re-reads the ~47k-token tool prefix (cached
after turn 1) **plus** the growing conversation + tool-result history (uncached),
and emits output. So one turn is several model calls, not one.

Worked estimate on the default model **Sonnet 4.6** ($3/1M input, $15/1M output;
cache-read ~$0.30/1M, cache-write ~$3.75/1M):

| Component (per turn, ~6 model calls) | Tokens | Cost |
| --- | --- | --- |
| Cached tool-prefix reads (47k × 6 calls) | 282k | ~$0.085 |
| Uncached input — history + tool results (~20k × 6) | 120k | ~$0.36 |
| Output — tool calls + final text (~1.5k × 6) | 9k | ~$0.13 |
| **≈ per moderate turn** | | **~$0.55** |

Plus a **one-time** ~$0.18 cache-write of the prefix on a conversation's first turn.

So the spread is wide and **tool-result size dominates** (the AmpUp server returns
rich JSON): a light 1–2-step turn is ~$0.10–0.20; a heavy 30-step turn with large
tool outputs can be **$2–3+**. `$5 / $0.55 ≈ 9`, so:

> **Recommended default `free_turns_limit ≈ 10`** — not ~25. This is an estimate;
> **measure real per-turn cost before launch** (the `conversation-debug` tooling
> reports per-turn cost/duration from actual prod/staging conversations) and set
> the limit from the measured median. The cost driver to watch is uncached
> tool-result tokens, not the cached prefix.

## 1. Extend `GET /api/v1/user/me` (`UserPublic`)

Add three fields. The chat route makes **one** `/user/me` call per turn and
classifies the caller from this payload — **no per-turn Stripe round-trip** once
`entitlement` is present.

| field              | type     | meaning                                                              |
| ------------------ | -------- | ------------------------------------------------------------------- |
| `entitlement`      | string   | `"subscribed"` \| `"pro"` \| `"unlimited"` → never metered; `"free"` → metered; `"none"` → blocked (must BYOK) |
| `free_turns_used`  | number   | turns consumed against the allowance                                |
| `free_turns_limit` | number   | total allowance (operator-configurable; `0`/absent → no free tier)  |

Route behavior (`fetchEntitlement` in `app/api/chat/route.ts`):

- `entitlement` ∈ {`subscribed`,`pro`,`unlimited`}, or `role` ∈ {`admin`,`super_admin`}, or a Pro-allowlisted email → **unlimited** (never metered).
- `entitlement === "free"` **and** `free_turns_limit > 0` → **free tier**, allowed while `free_turns_used < free_turns_limit`.
- Otherwise → **blocked** → `402 llm_key_required`.
- **Back-compat:** if `entitlement` is *absent*, the route falls back to the
  legacy Stripe lookup and there is **no** free tier — i.e. shipping this is a
  no-op until the fields appear, and rolling it out can't accidentally open the
  operator key to everyone.

## 2. Add `POST /api/v1/user/usage/increment`

Auth: `Authorization: Bearer <per-user sk-a79 key>` (same as `/user/me`).

- **Atomically** increment the calling user's `free_turns_used` by 1 and **enforce
  the cap server-side** (this endpoint is the authoritative backstop; the route's
  read-then-increment gate has a benign race).
- Return the new counts so the route can self-correct its cache and block the
  *next* turn the moment the limit is hit:

```json
{ "free_turns_used": 7, "free_turns_limit": 10 }
```

- Non-2xx / network failure is tolerated client-side (a turn is never failed
  because metering didn't record — worst case a user gets a few extra turns).

## Route-side behavior already implemented

- Gate + meter apply to **both** the opening turn and follow-ups (a free tier that
  only checked conversation-start would be bypassed by never starting a new chat).
- **BYOK turns are never gated or metered.** Known bounded leak: the conversation
  model is fixed at start (`workflows/chat.ts`), so a key pasted *mid*-conversation
  can't take effect on that run — an exhausted free user can finish that one
  operator-funded thread for free. New conversations correctly use their key.
- Entitlement is cached in-process, keyed on the **server-validated `mcpToken`**
  (never a client-supplied id), TTL `ENTITLEMENT_CACHE_TTL_MS` (default 60s), and
  refreshed from the increment response.

## Operator knobs

- `free_turns_limit` source-of-truth lives in AmpUp (per-user / per-org default).
- `ENTITLEMENT_CACHE_TTL_MS` (chat deploy env) trades hot-path `/user/me` load
  against how quickly a tier change propagates.
