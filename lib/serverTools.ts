// Provider-native web_search. Only Anthropic and Google have server-side search
// that completes the agent loop in one pass; other providers get no web search
// (warn + skip) rather than a silently-broken tool.
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { ToolSet } from "ai";

export type WebSearchConfig = { maxUses?: number };

export function buildServerTools(
  provider: string,
  webSearch?: WebSearchConfig,
): ToolSet {
  if (!webSearch) return {};
  if (provider === "anthropic") {
    return {
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: webSearch.maxUses,
      }),
    };
  }
  if (provider === "google") {
    return { google_search: google.tools.googleSearch({}) };
  }
  console.warn(
    `[serverTools] web_search requested but no native tool for provider "${provider}"; skipping`,
  );
  return {};
}
