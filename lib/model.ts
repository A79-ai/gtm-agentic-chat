// Resolve the chat model + its provider. Two sources, in priority order:
//   1. A per-user "bring your own key" (opts) — Anthropic / OpenAI / Google
//      direct, or a user-supplied Vercel AI Gateway key. Used so the operator's
//      key isn't spent on every visitor's chat (see app/api/chat/route.ts).
//   2. The operator's env key (single-org dev, or internal/Pro users):
//      ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY direct, else the Vercel
//      AI Gateway via a plain "provider/model" string. Anthropic wins if set.
//
// DurableAgent wants the model as a string (gateway) or a factory function
// (() => Promise<model>) so the workflow can reconstruct it on replay.
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelFactory = () => Promise<any>;

export type ResolvedModel = {
  model: string | ModelFactory;
  provider: string;
};

// A user's own LLM key, threaded from the client (never the operator's).
export type LlmOpts = {
  provider?: string;
  key?: string;
  model?: string;
};

export function resolveModel(opts?: LlmOpts): ResolvedModel {
  // 1. Bring-your-own key: build the chosen provider from the user's key.
  if (opts?.key && opts.provider) {
    const apiKey = opts.key;
    const m = opts.model?.trim() || undefined;
    switch (opts.provider) {
      case "anthropic":
        return {
          model: async () => createAnthropic({ apiKey })(m ?? "claude-sonnet-4-6"),
          provider: "anthropic",
        };
      case "openai":
        return {
          model: async () => createOpenAI({ apiKey })(m ?? "gpt-4o"),
          provider: "openai",
        };
      case "google":
        return {
          model: async () => createGoogleGenerativeAI({ apiKey })(m ?? "gemini-2.5-pro"),
          provider: "google",
        };
      case "gateway": {
        const id = m ?? "anthropic/claude-sonnet-4.6";
        const gw = createGateway({ apiKey });
        return { model: async () => gw(id), provider: id.split("/")[0] };
      }
      default:
        break;
    }
  }

  // 2. Operator (env) path — unchanged.
  const explicit = process.env.CHAT_MODEL;
  const bare = explicit && !explicit.includes("/") ? explicit : undefined;

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      model: async () => anthropic(bare ?? "claude-sonnet-4-6"),
      provider: "anthropic",
    };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      model: async () => google(bare ?? "gemini-2.5-pro"),
      provider: "google",
    };
  }

  // Gateway fallback: a plain string model id (e.g. "anthropic/claude-sonnet-4.6").
  const id = explicit ?? "anthropic/claude-sonnet-4.6";
  return { model: id, provider: id.split("/")[0] };
}
