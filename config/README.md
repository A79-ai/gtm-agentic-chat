# Editable config

These JSON files are the easy-to-edit source for the app's built-in lists. Edit
them and rebuild (`pnpm build`); no component code changes needed.

## `mcp-catalog.json`: recommended MCP servers

The "Recommended for GTM" cards on the Connectors page. Add an object per server:

| field | meaning |
|---|---|
| `name`, `slug` | display name + a stable unique id |
| `category` | badge text (e.g. `Prospecting`, `Research`, `Call recording`) |
| `domain` | used to fetch the brand logo (Google favicon) |
| `desc` | one-line description on the card |
| `url` | hosted MCP endpoint. Leave `""` for discovery-only (no Add/Connect) |
| `auth` | `apikey` → one-click **Add** (paste a key) · `oauth` → **Connect** (OAuth popup) |
| `noDcr` | set `true` for OAuth servers that need a pre-registered app (no dynamic client registration) → shown as "OAuth, soon" |
| `docsUrl` | "Docs" link |

## `agents.json`: built-in system agents

The personas on the Home screen. Add an object per agent:

| field | meaning |
|---|---|
| `id`, `name`, `desc`, `tag` | identity + card copy |
| `icon` | one of the names in `components/gtm/icons.jsx` (e.g. `Target`, `Phone`, `Mail`) |
| `tone` | `gold` \| `teal` \| `mint` accent |
| `systemPrompt` | the full instructions sent to the model (self-contained) |
| `includeAmpup` | `true` keeps the built-in CRM/meetings tools available |
| `mcpServerIds` | slugs of custom MCP servers this agent is scoped to (`[]` = none) |
| `fileIds` | datasource ids of uploaded files to inject as context |
| `tools` | connector ids shown as logos on the card (display only) |
| `starter` | `true` shows a "Starter" badge |

## Runtime (per-browser) data: NOT config files

These are created by users at runtime and live in the browser's `localStorage`
(one set per deployment + browser), so they aren't static files:

| data | localStorage key | code |
|---|---|---|
| User-added MCP servers (incl. OAuth tokens) | `ampup-mcp-servers` | `lib/gtm/mcpServers.js` |
| User-created agents | `ampup-agents` | `lib/gtm/agents.js` |
| Uploaded files (session) | `ampup-uploads` | `lib/gtm/data.jsx` |
| Saved conversations | `ampup-conversations` | `lib/gtm/data.jsx` |
