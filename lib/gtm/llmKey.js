// Bring-your-own LLM key (client side). Stored in localStorage and sent per
// request as x-llm-* headers; it is NEVER persisted server-side. The chat
// backend uses the operator's own key only for internal/Pro users — everyone
// else must bring their own (see app/api/chat/route.ts + lib/model.ts).

const KEY = "ampup-llm-key";

export const LLM_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-…",
    defaultModel: "claude-sonnet-4-6",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-…",
    defaultModel: "gpt-4o",
    keysUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    label: "Google Gemini",
    placeholder: "AIza…",
    defaultModel: "gemini-2.5-pro",
    keysUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "gateway",
    label: "Vercel AI Gateway",
    placeholder: "your gateway key",
    defaultModel: "anthropic/claude-sonnet-4.6",
    keysUrl: "https://vercel.com/docs/ai-gateway",
  },
];

export function getLlmKey() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v?.provider && v?.key) {
      return v;
    }
  } catch {
    // ignore malformed/unavailable storage
  }
  return null;
}

export function setLlmKey(v) {
  try {
    if (v?.provider && v?.key) {
      localStorage.setItem(
        KEY,
        JSON.stringify({ provider: v.provider, key: v.key, model: v.model || "" })
      );
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // ignore unavailable storage
  }
}

export function clearLlmKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore unavailable storage
  }
}
