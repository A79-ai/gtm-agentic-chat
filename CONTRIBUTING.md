# Contributing

Thanks for your interest in the **GTM Agentic Starter Kit**! This is a template
you're meant to fork and make your own — but improvements that help every
deployer (new agents, new connectors, bug fixes, docs) are very welcome upstream.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Dev setup

You'll need **Node ≥ 20** and **pnpm 10** (`corepack enable` will pick the
version pinned in `package.json`).

```bash
pnpm install
cp .env.example .env.local   # fill in your AmpUp MCP URL + key, and an LLM key
pnpm dev                     # http://localhost:3000
```

See [`.env.example`](./.env.example) for every variable. At minimum you need
`AMPUP_MCP_URL`, `AMPUP_MCP_API_KEY`, and an LLM key (`AI_GATEWAY_API_KEY` or a
provider key). The kit talks to **your** AmpUp org — nothing here phones home.

## Before you open a PR

Run the same checks CI runs — all three must pass:

```bash
pnpm check       # Biome lint + format
pnpm typecheck   # tsc --noEmit
pnpm build       # next build
```

`pnpm fix` auto-applies the lint/format fixes. The Playwright suite
(`pnpm test`) needs an AmpUp endpoint + LLM key in `.env.e2e` (see
[`.env.e2e.example`](./.env.e2e.example)); it runs in CI when those secrets are
configured and skips cleanly otherwise.

## Good first contributions

These are low-friction and high-value — no deep refactor required:

- **Add an agent.** Append an entry to [`config/agents.json`](./config/agents.json)
  (`id`, `name`, `icon`, `desc`, `systemPrompt`, `mcpCategories` or pinned
  `mcpServerIds`, `starterQuestions`). It shows up on the homepage grid
  automatically. See [`config/README.md`](./config/README.md).
- **Add an MCP connector** to [`config/mcp-catalog.json`](./config/mcp-catalog.json)
  (`name`, `slug`, `category`, `domain`, `desc`, `url`, `auth`, `docsUrl`). The
  `slug` is the canonical id agents target.
- **Docs**: clarify setup, fix a broken link, improve `.env.example` comments.
- **Bug fixes** with a short repro in the PR description.

## PR guidelines

- Keep PRs focused — one logical change per PR.
- Use a clear title; conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`)
  are appreciated but not required.
- Describe **what** changed and **why**, and how you verified it.
- For UI changes, include a before/after screenshot or clip.
- Don't commit secrets or real data. `.env*` files are gitignored — keep them
  that way. Screenshots/fixtures should use fictional companies.

## Reporting bugs & security issues

- **Bugs / feature requests**: open an issue using the templates.
- **Security vulnerabilities**: do **not** open a public issue — follow
  [SECURITY.md](./SECURITY.md) (email `security@a79.ai`).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
