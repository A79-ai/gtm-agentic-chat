// Resolve the chat model + its provider from env. Two supported paths:
//   1. ANTHROPIC_API_KEY set -> call Anthropic directly (you pay Anthropic).
//   2. AI_GATEWAY_API_KEY set -> route through the Vercel AI Gateway (model
//      passed as a plain "provider/model" string; the gateway resolves it).
// Anthropic wins when both are present.
//
// DurableAgent wants the model as a string (gateway) or a factory function
// (() => Promise<model>) so the workflow can reconstruct it on replay.
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelFactory = () => Promise<any>;

export type ResolvedModel = {
  model: string | ModelFactory;
  provider: string;
};

export function resolveModel(): ResolvedModel {
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
