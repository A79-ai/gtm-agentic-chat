# How this compares: GTM Agentic Starter Kit vs. Lightfield vs. Monaco

A new wave of AI-native sales tools wants to *be* your CRM. The GTM Agentic Starter Kit takes the opposite bet: it runs agentic chat **over the stack you already have**, on **infrastructure you already control**. This page is an honest look at where each option fits, especially if you are a founder or a small GTM team.

> Facts about Lightfield and Monaco below are sourced from their official sites and public coverage as of mid-2026. Marketing claims are labeled as such, and anything we could not verify is flagged. If something here is out of date, open an issue or a PR.

## At a glance

| | **GTM Agentic Starter Kit** | **Lightfield** | **Monaco** |
|---|---|---|---|
| **Category** | Open-source agentic GTM chat you deploy yourself | AI-native CRM (replaces HubSpot) | All-in-one AI revenue platform |
| **Deployment** | Your own Vercel account | SaaS only | SaaS only |
| **Where your data lives** | Your CRM + your infra; agents run over it | Lightfield cloud (portable: API, no egress fees) | Monaco cloud |
| **System of record** | Keeps your existing CRM (Salesforce/HubSpot) | Becomes your CRM | Becomes your CRM |
| **Source available** | Yes, MIT licensed, fork it | No (open API + MCP, not open source) | No |
| **Connectors** | Salesforce, HubSpot, Gong, Fireflies, Apollo, plus any MCP server | Email/calendar/meetings/Slack/support | Built-in TAM + capture (no SFDC/HubSpot sync found) |
| **Pricing shape** | Your Vercel + model spend + hosted AmpUp backend | Per seat, $89 to $249/user/mo (+ $2k+/mo tier) | Flat fee, not public (beta) |
| **Human service layer** | No | No | Yes: forward-deployed AEs |

## Lightfield

**What it is:** an "AI-native CRM" from the team behind Tome, pitched as a direct replacement for HubSpot. It auto-captures every email, meeting, and call, builds the CRM for you, and lets you query that conversation data in natural language with citations. It exposes an API and an MCP server, and offers a one-hour CSV migration off legacy CRMs.

**Pricing (from their pricing page):** Startup at $89/user/mo, Pro at $249/user/mo (billed annually), and a Growth tier at $2,000+/mo per workspace. No free tier; a free trial is available.

**Honest take for a founder:** strong product with fast onboarding and, notably, a clear data-portability stance (their CEO has publicly said your data is yours, accessible via API with no egress fees). The trade-offs are that it is SaaS only (your conversation corpus lives in Lightfield's cloud by default), pricing is per seat, and it *replaces* your CRM rather than running alongside Salesforce or HubSpot.

## Monaco

**What it is:** "the first revenue engine for startups," an all-in-one AI-native platform that replaces a legacy CRM plus the usual point solutions. It ships a pre-built TAM, AI scoring and segmentation, outbound autopilot, call capture, signal-based pipeline stages, and an "Ask Monaco" copilot. Its defining feature is human **forward-deployed AEs** embedded with the customer, not just software. It raised over $85M (Founders Fund, then Benchmark) and is in public beta.

**Pricing:** flat fee rather than per seat, but **not public** (the pricing page 404s and a demo is required). One third-party analyst *estimated* roughly $500 to $2,000+/mo given the embedded-human service component; treat that as unverified.

**Honest take for a founder:** the embedded human AEs are a real edge if you are a non-sales founder who wants GTM expertise, not just tooling, and that is something a self-serve template does not replicate. The trade-offs are opaque pricing, beta-stage maturity, a SaaS-only proprietary data store with no stated portability guarantee, and (like Lightfield) it replaces rather than syncs with an existing CRM.

## Where the Starter Kit is different

The contrast is categorical, not a feature checklist:

1. **You host it.** It deploys to your own Vercel account and runs over your own CRM, meetings, and knowledge base. The app and the agent loop live in infrastructure you control.
2. **It works *with* your CRM, not instead of it.** It reads Salesforce, HubSpot, and Gong through connectors rather than asking you to rip out your system of record. Useful when you cannot or will not migrate.
3. **It is open source.** MIT licensed, so you can read every line, fork it, add your own agents (plain JSON) and MCP servers, and ship. That is the biggest lever for a GTM engineer.
4. **Different cost basis.** Instead of a per-seat subscription, you pay for your own Vercel hosting, your model usage, and the hosted AmpUp backend that handles connectors, auth, and scale.

We are not claiming the competitors trap your data (Lightfield explicitly promises portability), and we are not claiming feature parity with a funded, full-service platform. Monaco's human AEs and Lightfield's polished CRM are genuine strengths.

## So which should you pick?

- **Want a managed CRM and you are happy living in a vendor's cloud?** Lightfield is a strong, well-built option.
- **A non-technical founder who wants humans plus software to run GTM for you?** Monaco's forward-deployed model is built for exactly that.
- **A founder, sales-ops, marketing-ops, or GTM engineer who wants AI agents over the data and tools you already own, on infrastructure you control, that you can read and extend?** That is what this kit is for. It is **simple enough to stand up yourself**, and you can **run it on your own Vercel** in a few minutes. Bring an AmpUp key and a model key, and you have agents over your real pipeline, calls, and notes, with the enterprise connectors and auth/scale handled for you.

[Deploy it now](./README.md#deploy) or [star the repo](https://github.com/a79-ai/gtm-agentic-chat) to follow along.
