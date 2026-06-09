# Security Policy

## Reporting a vulnerability

If you discover a security issue in this template, please report it privately —
do **not** open a public GitHub issue.

- Email **security@a79.ai** (or **support@a79.ai**) with a description, the
  affected file(s)/route(s), and steps to reproduce.
- We aim to acknowledge within 3 business days and to provide a remediation
  timeline after triage.

Please give us a reasonable window to ship a fix before any public disclosure.

## Scope

This repository is a **self-deployable client**. When you deploy it, you run it
in your own Vercel account with your own credentials, so you own the security of
your deployment. Reports about the template code itself (the routes, the auth
flows, the build) are in scope. Reports about *your* deployment's
misconfiguration (e.g. unset secrets) are best handled via the hardening notes
below.

## Deploying securely (operator checklist)

The template ships with sensible defaults, but a production / multi-tenant
deployment should set the following explicitly:

- **Set strong, unique signing secrets.** `AUTH_SESSION_SECRET` and
  `OAUTH_STATE_SECRET` must be set to random values (`openssl rand -hex 32`) when
  the Google sign-in or OAuth-connect flows are enabled. Do not rely on defaults.
- **Never commit secrets.** Only `.env.example` is tracked; real keys live in
  Vercel environment variables. Server secrets (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_SECRET`, `AMPUP_MCP_API_KEY`) are read
  server-side only and are never sent to the browser.
- **Restrict CORS.** Set `ALLOWED_ORIGIN` to your deployment's own origin rather
  than the `*` default before exposing the chat API publicly.
- **Multi-tenant mode.** When serving more than one user, set `MULTI_TENANT=true`
  together with the Auth0 variables so data routes require a per-user minted key
  and never fall back to the shared `AMPUP_MCP_API_KEY`.
- **Transcript replay.** The cold-reopen replay route is gated behind the
  per-user key in multi-tenant mode; keep `MULTI_TENANT=true` if conversations
  are user-specific.

## Where your data goes

See [PRIVACY.md](./PRIVACY.md) for the full data-flow disclosure.
