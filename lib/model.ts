// Resolve the chat model + its provider. Two sources, in priority order:
//   1. A per-user "bring your own key" (opts) — Anthropic / OpenAI / Google
//      direct, or a user-supplied Vercel AI Gateway key. Used so the operator's
//      key isn't spent on every visitor's chat (see app/api/chat/route.ts).
//   2. The operator's env key (single-org dev, or internal/Pro users):
//      ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY direct, else the Vercel
//      AI Gateway via a plain "provider/model" string. Anthropic wins if set.
//
// DurableAgent wants the model as a STRING (a gateway model id) or a
// workflow-REGISTERED factory (a "use step" function whose closure inputs are
// serializable strings). A plain runtime closure is NOT serializable — the
// durable runtime devalue-serializes step args and crashes with "Cannot
// stringify a function" — so every factory below is a registered step (see
// stepAnthropic/etc.), mirroring @workflow/ai's own provider wrappers.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

// Each factory returns a workflow-registered step (the "use step" directive):
// the model is constructed INSIDE the step from serializable string inputs, so it
// crosses the durable step boundary as a step reference + serialized args rather
// than as an unserializable function. (apiKey is a string and rides along as a
// step arg — the same place the key already lives in the persisted run input.)
function stepAnthropic(apiKey: string, modelId: string) {
  return async () => {
    "use step";
    return createAnthropic({ apiKey })(modelId);
  };
}
function stepOpenAI(apiKey: string, modelId: string) {
  return async () => {
    "use step";
    return createOpenAI({ apiKey })(modelId);
  };
}
function stepGoogle(apiKey: string, modelId: string) {
  return async () => {
    "use step";
    return createGoogleGenerativeAI({ apiKey })(modelId);
  };
}
function stepGateway(apiKey: string, modelId: string) {
  return async () => {
    "use step";
    return createGateway({ apiKey })(modelId);
  };
}

export function resolveModel(opts?: LlmOpts): ResolvedModel {
  // 1. Bring-your-own key: build the chosen provider from the user's key.
  if (opts?.key && opts.provider) {
    const apiKey = opts.key;
    const m = opts.model?.trim() || undefined;
    switch (opts.provider) {
      case "anthropic":
        return { model: stepAnthropic(apiKey, m ?? "claude-sonnet-4-6"), provider: "anthropic" };
      case "openai":
        return { model: stepOpenAI(apiKey, m ?? "gpt-4o"), provider: "openai" };
      case "google":
        return { model: stepGoogle(apiKey, m ?? "gemini-2.5-pro"), provider: "google" };
      case "gateway": {
        const id = m ?? "anthropic/claude-sonnet-4.6";
        return { model: stepGateway(apiKey, id), provider: id.split("/")[0] };
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
      model: stepAnthropic(process.env.ANTHROPIC_API_KEY, bare ?? "claude-sonnet-4-6"),
      provider: "anthropic",
    };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      model: stepGoogle(process.env.GOOGLE_GENERATIVE_AI_API_KEY, bare ?? "gemini-2.5-pro"),
      provider: "google",
    };
  }

  // Gateway fallback: a plain string model id (e.g. "anthropic/claude-sonnet-4.6").
  const id = explicit ?? "anthropic/claude-sonnet-4.6";
  return { model: id, provider: id.split("/")[0] };
}
