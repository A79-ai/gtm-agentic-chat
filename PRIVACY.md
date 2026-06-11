# Privacy & Data Flow

This is a **self-hosted** template. When you deploy it, the application runs
entirely inside **your own Vercel account** under your own credentials. The
authors of this template do not operate a server in the request path and
**receive none of your data**.

This document explains exactly where data goes so you can decide what you're
comfortable connecting.

## What runs where

```
                    ┌──────────────────────────────────────────────┐
   Your browser ──► │  Your Vercel deployment (this app)           │
                    │  - Next.js routes + durable Workflow runtime │
                    └───┬───────────────┬───────────────┬──────────┘
                        │               │               │
                        ▼               ▼               ▼
                  LLM provider     AmpUp MCP        Optional services
                  (Anthropic or    (your org's      (connected MCP servers,
                   Vercel AI       a79dev.com       Ampersand, Stripe, Auth0,
                   Gateway)        endpoint)         Google sign-in)
```

## External destinations

| Destination | What is sent | When |
|---|---|---|
| **LLM provider**: Anthropic API (`ANTHROPIC_API_KEY`) **or** the Vercel AI Gateway (`AI_GATEWAY_API_KEY`) | Your chat messages, the system prompt, attached record/file context, and tool results (whatever the model needs to answer) | Every chat turn |
| **AmpUp MCP**: your org's `AMPUP_MCP_URL` (`*.a79dev.com`) | CRM / meeting / task tool calls and their arguments, authenticated with your AmpUp key | When the agent reads or writes your CRM data |
| **Connected MCP servers** (optional, user-added) | Tool calls to any third-party MCP server *you* connect, using the URL + token you provide | Only for servers you explicitly connect |
| **Ampersand** (optional) | OAuth connect flow for third-party connectors; uses the public Ampersand UI key | Only when you use the Connectors "Connect" flow |
| **Auth0** (optional, multi-tenant) | Login; mints a short-lived per-user key | Only when Auth0 env vars are set |
| **Stripe** (optional, billing) | Checkout / subscription management; card data goes directly to Stripe, never through this app | Only when `NEXT_PUBLIC_BILLING_PROVIDER=stripe` |
| **Google** (optional, sign-in) | OAuth sign-in; the app stores only a signed session cookie with your email | Only when Google sign-in is enabled |

## What is stored

- **Conversation / run state** is managed by the **Workflow DevKit durable
  runtime inside your own deployment**: the stream *is* the transcript. There is
  no separate analytics or transcript database, and nothing is shipped to the
  template authors.
- **Browser `localStorage`** holds your connected MCP servers (and their tokens),
  your custom agents, and onboarding flags, on your device only.
- **No telemetry.** This template does not phone home.

## Your responsibilities as the operator

Because you host it, you are the data controller for your deployment. Review the
privacy terms of the providers you enable (Anthropic / Vercel, Stripe, Auth0,
Google, and any MCP servers you connect), set the signing secrets and
`ALLOWED_ORIGIN` described in [SECURITY.md](./SECURITY.md), and use
`MULTI_TENANT=true` if more than one person will use the deployment.

_Questions: **support@a79.ai**._
