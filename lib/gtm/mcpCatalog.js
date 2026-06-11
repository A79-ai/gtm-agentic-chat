// Curated catalog of useful MCP servers for GTM agents, loaded from the
// editable config file at `config/mcp-catalog.json`. Add or edit entries there.
//
// Each entry: { name, slug, category, domain, desc, url, auth, docsUrl, noDcr? }
//   auth "apikey": connects with a static key/token (Bearer). Works via the
//                   Add-MCP modal today.
//   auth "oauth":  needs an OAuth handshake. If the server supports dynamic
//                   client registration it shows a "Connect" (popup) button;
//                   set "noDcr": true for servers that require a pre-registered
//                   app (they stay "OAuth: soon").
//   url "":        no documented hosted endpoint; listed for discovery only.
import catalog from "@/config/mcp-catalog.json";

export const MCP_CATALOG = catalog;

export const AUTH_LABEL = {
  apikey: "API key",
  oauth: "OAuth",
};
