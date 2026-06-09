# GTM Agentic Chat

A self-deployable, agentic chat app over your **CRM, meetings/notetaker, and
knowledge base** — powered by the [AmpUp](https://a79.ai) MCP server and the
[Vercel AI SDK](https://sdk.vercel.ai) + [Workflow DevKit](https://workflow.dev).

You bring an AmpUp API key (which scopes the app to your org's data) and an LLM
key. The app discovers your org's tools at runtime and lets you chat over your
live data — "list my open opportunities", "summarize my last meeting with Acme",
"what tasks are due this week".

The connectors, data sync, access control, and hydration all live **behind your
AmpUp MCP endpoint** — this app is a thin, durable chat client in front of it.

![Home — agents over your live CRM, calls and notes](./public/screenshots/01-home.png)

|  |  |
|---|---|
| ![Chat grounded in a deal](./public/screenshots/02-chat.png) | ![Your pipeline, synced from the CRM](./public/screenshots/03-deals.png) |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/a79-ai/gtm-agentic-chat)

> The one-click Deploy button requires the repo to be **public**. If you're
> viewing a private fork, clone it and deploy with the Vercel CLI
> (`vercel deploy`) instead.

Set these environment variables (Vercel will prompt for the required ones):

| Variable | Required | What it is |
|---|---|---|
| `AMPUP_MCP_URL` | ✅ | Your org's MCP endpoint, e.g. `https://<org>.a79dev.com/mcp` |
| `AMPUP_MCP_API_KEY` | ✅ | Your AmpUp API key (`sk-a79-…`) — scopes all data access to your org |
| `ANTHROPIC_API_KEY` | one of | Bring your own Anthropic key (calls Anthropic directly; you pay Anthropic) |
| `AI_GATEWAY_API_KEY` | one of | Use the Vercel AI Gateway instead (unified billing; needs a funded balance) |
| `CHAT_MODEL` | – | Override the model (default `claude-sonnet-4-6`, or `anthropic/claude-sonnet-4.6` on the gateway) |
| `SYSTEM_PROMPT` | – | Override the assistant's system prompt |
| `ENABLE_WEB_SEARCH` | – | `true` to enable provider-native web search (Anthropic/Google) |
| `ALLOWED_ORIGIN` | – | Restrict CORS on the chat API (default `*`) |

Pick **one** LLM path — `ANTHROPIC_API_KEY` wins if both are set.

## How it works

- **`app/page.tsx` + `components/gtm/`** — the AmpUp GTM Agent UI: a dark left
  rail, Home (agents gallery + connected sources), Connectors, CRM entity
  list/detail, and the grounded Chat workspace (attach picker + context panel),
  with light/dark theme. Styled by the design system in `app/ds/`.
- **`app/api/records/route.ts`** — MCP-backed listing of accounts / deals /
  meetings / tasks, mapped to the entity schema the UI reads (`lib/gtm/data.jsx`).
- The Chat surface still streams Markdown (Streamdown) and threads the durable
  run id across turns; sends are augmented with attached-record context.
- **`app/api/chat/route.ts`** — starts one durable workflow run per conversation
  (first turn) and resumes it for follow-ups.
- **`workflows/chat.ts`** — the durable agent loop. Runs on the Vercel Workflow
  DevKit, so each turn (and each tool call) is a durable, replayable step.
- **`lib/mcp.ts`** — connects to your `AMPUP_MCP_URL` over streamable HTTP.
  `listAmpupTools` discovers your org's tools at runtime (`tools/list`); each
  tool call is forwarded with your key. No tool list is baked into the build.
- **`lib/model.ts`** — resolves the LLM from env (direct Anthropic or AI Gateway).

## Local development

```bash
cp .env.example .env.local   # fill in AMPUP_MCP_URL, AMPUP_MCP_API_KEY, an LLM key
pnpm install
pnpm dev                     # http://localhost:3000
```

The durable workflow runtime runs locally via the Workflow DevKit
(`pnpm workflow:web` for the workflow dashboard).

## Notes / limits

- **One org per deployment.** The MCP key in env scopes everything to one org.
  To serve multiple orgs/users, front `/api/chat` with your own auth and pass a
  per-request `x-ampup-mcp-key` header.
- **Cold starts (observed, cause unconfirmed).** Right after a deploy, a request
  occasionally truncated before the agent finished; retrying succeeded, and
  steady-state requests were reliable. If you see a turn cut short, retry.
- Conversation history lives in the durable run (the stream *is* the transcript);
  there's no separate database. Cold-reopen replay at `/api/conversation/[runId]`
  is gated behind the per-user key in multi-tenant mode — keep `MULTI_TENANT=true`
  when conversations are user-specific.

## Privacy, security & license

- **[PRIVACY.md](./PRIVACY.md)** — exactly where your data goes. This is a
  self-hosted client: it runs in **your** Vercel account with **your**
  credentials, and the template authors receive none of your data. Your chat
  data flows only to your chosen LLM provider (Anthropic or the Vercel AI
  Gateway) and to your AmpUp MCP endpoint; there is no telemetry and no
  transcript database.
- **[SECURITY.md](./SECURITY.md)** — how to report a vulnerability
  (`security@a79.ai`) and an operator hardening checklist (set
  `AUTH_SESSION_SECRET` / `OAUTH_STATE_SECRET`, restrict `ALLOWED_ORIGIN`, use
  `MULTI_TENANT=true` for more than one user).
- **License:** [MIT](./LICENSE).
