// Curated catalog of useful MCP servers for GTM agents. These are discovery
// suggestions: clicking "Add" prefills the Add-MCP modal with the name + URL,
// then the user supplies their API key and tests the connection.
//
// `auth`:
//   "apikey" — authenticates with a static key/token sent as a Bearer header
//              (or via the URL). These work today through the Add-MCP modal.
//   "oauth"  — requires an interactive OAuth handshake the simple token modal
//              can't perform, so these are listed for discovery but not yet
//              one-click addable (see the "OAuth — soon" state). Use the Docs
//              link to connect them in the meantime.
//
// Every API-key entry ships a real hosted endpoint so "Add" is fully prefilled.

export const MCP_CATALOG = [
  // ---- Prospecting & enrichment ----
  {
    name: "Explorium", slug: "explorium", category: "Prospecting",
    desc: "Find & enrich companies and contacts — firmographics and technographics.",
    url: "https://vibeprospecting.explorium.ai/mcp", auth: "apikey", docsUrl: "https://www.explorium.ai/",
  },
  {
    name: "Apollo.io", slug: "apollo", category: "Prospecting",
    desc: "B2B contact & company database for building lead lists.",
    url: "", auth: "oauth", docsUrl: "https://docs.apollo.io/docs/apollo-mcp",
  },
  {
    name: "Clay", slug: "clay", category: "Prospecting",
    desc: "Data enrichment and outbound workflows across 100+ sources.",
    url: "https://mcp.clay.earth/mcp", auth: "oauth", docsUrl: "https://www.clay.com/",
  },

  // ---- Research & web ----
  {
    name: "Exa", slug: "exa", category: "Research",
    desc: "Neural web search, company research and LinkedIn lookups.",
    url: "https://mcp.exa.ai/mcp", auth: "apikey", docsUrl: "https://docs.exa.ai/examples/exa-mcp",
  },
  {
    name: "Tavily", slug: "tavily", category: "Research",
    desc: "Real-time web search, extract, map and crawl for research.",
    url: "https://mcp.tavily.com/mcp", auth: "apikey", docsUrl: "https://github.com/tavily-ai/tavily-mcp",
  },
  {
    name: "Firecrawl", slug: "firecrawl", category: "Research",
    desc: "Scrape and crawl any site into clean, agent-ready content.",
    url: "https://mcp.firecrawl.dev/v2/mcp", auth: "apikey", docsUrl: "https://docs.firecrawl.dev/",
  },

  // ---- Payments / revenue ops ----
  {
    name: "Stripe", slug: "stripe", category: "Payments",
    desc: "Look up customers, subscriptions and invoices for revenue ops.",
    url: "https://mcp.stripe.com", auth: "apikey", docsUrl: "https://docs.stripe.com/mcp",
  },

  // ---- OAuth (discovery only for now) ----
  {
    name: "HubSpot", slug: "hubspot-mcp", category: "CRM",
    desc: "Read & write CRM objects, activities and marketing content.",
    url: "https://mcp.hubspot.com", auth: "oauth", docsUrl: "https://developers.hubspot.com/mcp",
  },
  {
    name: "Linear", slug: "linear", category: "Productivity",
    desc: "Create and track issues, projects and cycles from chat.",
    url: "https://mcp.linear.app/mcp", auth: "oauth", docsUrl: "https://linear.app/docs/mcp",
  },
  {
    name: "Notion", slug: "notion", category: "Productivity",
    desc: "Search and update Notion pages, docs and databases.",
    url: "https://mcp.notion.com/mcp", auth: "oauth", docsUrl: "https://developers.notion.com/",
  },
  {
    name: "Sentry", slug: "sentry", category: "Dev & support",
    desc: "Surface errors and issues to triage customer-facing bugs.",
    url: "https://mcp.sentry.dev/mcp", auth: "oauth", docsUrl: "https://mcp.sentry.dev/",
  },
];

export const AUTH_LABEL = {
  apikey: "API key",
  oauth: "OAuth",
};
