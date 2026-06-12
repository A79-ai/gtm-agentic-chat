# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-deployable, open-source (MIT) **agentic GTM chat** template: Next.js 16 + React 19 app that runs sales agents over your CRM / meetings / knowledge base via the **AmpUp MCP server**. Built on the **Vercel AI SDK v6** + **Workflow DevKit** durable runtime. Meant to be forked — the GTM-specific parts (agents, connectors) are JSON data, not code.

## Commands

Package manager is **pnpm 10** (Node ≥ 20). `corepack enable` picks the pinned version.

```bash
pnpm dev          # next dev → http://localhost:3000
pnpm build        # next build (CI gate)
pnpm typecheck    # tsc --noEmit (CI gate)
pnpm check        # Biome lint + format, no writes (CI gate)
pnpm fix          # Biome auto-fix lint + format
pnpm test         # Playwright e2e
pnpm test:ui      # Playwright in UI mode
pnpm workflow:web # Workflow DevKit dashboard (durable run inspector)
pnpm bench        # next dev on port 3100 from .env.e2e (local e2e bench)
```

Run a single Playwright test: `pnpm test e2e/chat.spec.ts` or `pnpm test -g "test name"`.

Before opening a PR, all three CI gates must pass: `pnpm check && pnpm typecheck && pnpm build`.

## Architecture: the durable chat loop

The core is `workflows/chat.ts` (`conversationWorkflow`, marked `"use workflow"`) driven by `app/api/chat/route.ts`. Read these two files first — they hold the non-obvious runtime model.

- **One durable run per conversation.** The first turn calls `start(conversationWorkflow, …)`; follow-ups call `turnHook.resume("conv:<id>", …)` to append to the **same** durable stream. The run's stream *is* the transcript — replaying it rehydrates the chat on reopen. There is no transcript database.
- **Tools are discovered at runtime**, never baked into the build. `lib/mcp.ts` connects to each MCP server over streamable HTTP and calls `tools/list`. The built-in `ampup` server comes from env (`AMPUP_MCP_URL` / `AMPUP_MCP_API_KEY`); users add more servers in Connectors. Each server's tools are namespaced `mcp__<slug>__<tool>` to avoid collisions. The ampup server alone advertises ~289 tools.
- **The MCP SDK is only ever `await import()`-ed inside a `"use step"`** (see `discoverToolsStep` / `callMcpStep`), so its Node deps never enter the workflow bundle.
- **Server set + system prompt are fixed at conversation start** (tools discovered once, reused across turns). Only the ampup token is re-minted per turn; custom-server tokens are captured once.
- **Tool-prefix prompt caching:** `applyToolCacheBreakpoint` puts one Anthropic `cacheControl: ephemeral` breakpoint on the last tool so turns 2+ read the ~47k-token tool block from cache. Honored only on the Anthropic-direct path; **ignored by other providers and unverified on the Vercel AI Gateway**.

### Serialization constraint (important when editing `workflows/` or `lib/model.ts`)

The Workflow DevKit devalue-serializes step args across the durable boundary. **A plain function closure crashes with "Cannot stringify a function."** Consequences:

- The model is passed as a workflow-**registered step factory** (`stepAnthropic`/`stepOpenAI`/… in `lib/model.ts`), constructed *inside* a `"use step"` from serializable string inputs — not as a runtime closure.
- Server-side stream smoothing (`smoothStream` / custom `experimental_transform`) is **not viable** for the same reason; cadence smoothing is done client-side via `useChat`'s `experimental_throttle`.
- `"use workflow"` / `"use step"` functions must be `async` even when they never await (the framework requires it — hence biome's `useAwait` is off).

## Model + key resolution

`lib/model.ts` `resolveModel(opts)` picks the LLM in priority order:
1. **Bring-your-own key** (`LlmOpts` from `x-llm-*` request headers) — anthropic / openai / google direct, or a user gateway key.
2. **Operator env key** — `ANTHROPIC_API_KEY` (wins) or `GOOGLE_GENERATIVE_AI_API_KEY` direct, else Vercel AI Gateway via a plain `provider/model` string.

In multi-tenant mode the operator key only powers chat for verified internal/Pro callers (`operatorKeyAllowed` in the chat route checks the user's own MCP key against `/api/v1/user/me`, the Pro allowlist, and Stripe). Otherwise the route returns `402 llm_key_required`.

## Single-org vs multi-tenant

- **Default (single-org):** one deploy = one org. The env `AMPUP_MCP_API_KEY` scopes every tool call. No login required.
- **Multi-tenant (`MULTI_TENANT=true` + Auth0):** each visitor logs in, mints a **per-user** AmpUp key, and sees only their own data, with **no** shared-env-key fallback. Backbone is `lib/gtm/auth.jsx`. The chat route logs a warning if Auth0 is configured client-side but `MULTI_TENANT` isn't on (per-user scoping would be silently bypassed).

## Layout & conventions

- **`config/agents.json`** and **`config/mcp-catalog.json`** are the editable data for the homepage agent gallery and the recommended-connector catalog. Edit + rebuild; no component changes needed. Field reference is in `config/README.md`.
- **`lib/*.ts`** is server-side infra (`mcp.ts`, `model.ts`, `config.ts`, `serverTools.ts`, `stripe.ts`, `ssrf.ts`, `mcpOauth.ts`, `recordMap.ts`).
- **`lib/gtm/*.js` / `*.jsx`** is the client/data layer. Note that **user-created agents, added MCP servers, uploads, and saved conversations live in browser `localStorage`** (keys like `ampup-agents`, `ampup-mcp-servers`), *not* in files — see the table in `config/README.md`.
- **`app/api/*/route.ts`** are the API routes; most data routes are MCP-backed (`records`, `search`, `counts`, `create`, etc.). `app/embed/page.tsx` + `public/widget.js` power the embeddable widget (chrome-less iframe behind a Shadow-DOM launcher).
- **`components/gtm/`** = the app UI; **`app/ds/`** = the light/dark design system; **`components/ai-elements/`** + **`components/ui/`** = shadcn-style primitives.
- Path alias: `@/*` → repo root (e.g. `@/lib/config`).

## Linting

Biome with the **ultracite** preset (`biome.jsonc`), 2-space indent, 100-col. The repo predates the linter, so many stylistic / a11y / complexity rules are deliberately relaxed to a ratcheting baseline while bug-catching correctness/security rules stay errors — read the inline comments before re-enabling any rule. `public/widget.js` (hand-tuned ES5) and all `*.css` are excluded from formatting on purpose.

## Tests

Playwright e2e (`e2e/`) self-gates by target:
- **chat** + **entities** specs run against a local single-org bench: `pnpm test` boots `next dev` from `.env.e2e` (copy `.env.e2e.example` — needs an AmpUp MCP URL + key) and drives the live durable runtime.
- **login** specs run against a deployed app: `E2E_BASE_URL=https://your-app.vercel.app pnpm test` (asserts Auth0 handoff, no credentials needed).

Specs skip cleanly when their env/secrets are unset, so CI runs only what's configured.
